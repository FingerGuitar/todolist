import { ipcMain } from 'electron'
import { eq, and, inArray, gte, lte } from 'drizzle-orm'
import { getDb } from '../database'
import { loadSettings } from '../settings'
import { chatCompletion, extractJson } from './llm-client'
import {
  buildParseTaskPrompt,
  buildBatchParseTasksPrompt,
  buildDecomposeTaskPrompt,
  buildGenerateReportPrompt,
  buildSuggestTagsPrompt
} from './prompts'
import { tasks, categories, tags, taskTags } from '../../shared/schema'
import { IPC_CHANNELS, STATUS } from '../../shared/types'
import { formatLocalDate } from '../../shared/date-utils'
import type {
  LlmSettings,
  LlmTestResult,
  LlmParseTaskInput,
  LlmParseTaskResult,
  LlmDecomposeTaskInput,
  LlmDecomposeTaskResult,
  LlmGenerateReportInput,
  LlmGenerateReportResult,
  LlmSuggestTagsInput,
  LlmSuggestTagsResult,
  LlmBatchParseTasksInput,
  LlmBatchParseTasksResult,
  Task,
  Category,
  Tag,
  TaskWithRelations,
  Priority
} from '../../shared/types'

function getLlmConfig(): LlmSettings {
  const settings = loadSettings()
  if (!settings.llm.enabled) {
    throw new Error('AI 功能未启用，请在设置中开启')
  }
  return settings.llm
}

function enrichTask(task: Task): TaskWithRelations {
  const db = getDb()
  const category = task.categoryId
    ? (db.select().from(categories).where(eq(categories.id, task.categoryId)).get() as Category | null) ?? null
    : null
  const taskTagRows = db
    .select({ tagId: taskTags.tagId })
    .from(taskTags)
    .where(eq(taskTags.taskId, task.id))
    .all()
  const tagList =
    taskTagRows.length > 0
      ? (db
          .select()
          .from(tags)
          .where(inArray(tags.id, taskTagRows.map((r) => r.tagId)))
          .all() as Tag[])
      : []
  return { ...task, category, tags: tagList, attachmentCount: 0 }
}

export function registerLlmIpcHandlers(): void {
  // Test connection
  ipcMain.handle(IPC_CHANNELS.LLM_TEST, async (): Promise<LlmTestResult> => {
    try {
      const config = loadSettings().llm
      if (!config.baseUrl) {
        return { success: false, message: '请先配置 API 地址' }
      }

      const start = Date.now()
      const res = await chatCompletion(
        { ...config, enabled: true, maxTokens: 20, timeoutMs: config.timeoutMs },
        [{ role: 'user', content: '请回复"连接成功"' }]
      )
      const latencyMs = Date.now() - start

      return {
        success: true,
        message: `连接成功（模型: ${config.model}，延迟: ${latencyMs}ms）`,
        latencyMs
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      return { success: false, message }
    }
  })

  // Parse natural language to task
  ipcMain.handle(
    IPC_CHANNELS.LLM_PARSE_TASK,
    async (_e, input: LlmParseTaskInput): Promise<LlmParseTaskResult> => {
      try {
        const config = getLlmConfig()
        const db = getDb()
        const catList = db.select().from(categories).all() as Category[]
        const tagList = db.select().from(tags).all() as Tag[]

        const messages = buildParseTaskPrompt(input.text, catList, tagList)
        const res = await chatCompletion(config, messages, true)
        const parsed = extractJson(res.content) as {
          title: string
          description: string
          priority: number
          categoryId: number | null
          dueDate: string | null
          tagIds: number[]
        }

        // Validate categoryId exists
        if (parsed.categoryId !== null) {
          const exists = catList.some((c) => c.id === parsed.categoryId)
          if (!exists) parsed.categoryId = null
        }
        // Validate tagIds exist
        const validTagIds = new Set(tagList.map((t) => t.id))
        parsed.tagIds = (parsed.tagIds || []).filter((id) => validTagIds.has(id))
        // Clamp priority
        parsed.priority = Math.max(0, Math.min(4, Math.round(parsed.priority || 0)))

        return {
          success: true,
          data: {
            title: parsed.title || input.text,
            description: parsed.description || '',
            priority: parsed.priority as Priority,
            categoryId: parsed.categoryId,
            dueDate: parsed.dueDate,
            tagIds: parsed.tagIds
          }
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : '解析失败' }
      }
    }
  )

  // Decompose task into subtasks
  ipcMain.handle(
    IPC_CHANNELS.LLM_DECOMPOSE_TASK,
    async (_e, input: LlmDecomposeTaskInput): Promise<LlmDecomposeTaskResult> => {
      try {
        const config = getLlmConfig()
        const db = getDb()
        const task = db.select().from(tasks).where(eq(tasks.id, input.taskId)).get() as Task | undefined
        if (!task) {
          return { success: false, error: '任务不存在' }
        }

        const enriched = enrichTask(task)
        const messages = buildDecomposeTaskPrompt({
          title: enriched.title,
          description: enriched.description,
          categoryName: enriched.category?.name
        })

        const res = await chatCompletion(config, messages, true)
        const parsed = extractJson(res.content) as {
          subtasks: { title: string; description: string; priority: number }[]
        }

        const subtasks = (parsed.subtasks || []).map((s) => ({
          title: s.title,
          description: s.description || '',
          priority: (Math.max(0, Math.min(4, Math.round(s.priority || 0)))) as Priority
        }))

        return { success: true, data: { subtasks } }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : '拆解失败' }
      }
    }
  )

  // Generate report
  ipcMain.handle(
    IPC_CHANNELS.LLM_GENERATE_REPORT,
    async (_e, input: LlmGenerateReportInput): Promise<LlmGenerateReportResult> => {
      try {
        const config = getLlmConfig()
        const db = getDb()

        const baseDate = input.date ? new Date(input.date) : new Date()
        let startDate: string
        let endDate: string

        if (input.type === 'daily') {
          startDate = formatLocalDate(baseDate)
          endDate = startDate
        } else {
          // Weekly: go back to Monday
          const day = baseDate.getDay()
          const mondayOffset = day === 0 ? -6 : 1 - day
          const monday = new Date(baseDate)
          monday.setDate(baseDate.getDate() + mondayOffset)
          const sunday = new Date(monday)
          sunday.setDate(monday.getDate() + 6)
          startDate = formatLocalDate(monday)
          endDate = formatLocalDate(sunday)
        }

        // Query completed tasks in date range (by completedAt date part)
        const completedTasks = db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.status, STATUS.COMPLETED),
              gte(tasks.completedAt, startDate),
              lte(tasks.completedAt, endDate + ' 23:59:59')
            )
          )
          .all() as Task[]

        const enrichedTasks = completedTasks.map(enrichTask)
        const messages = buildGenerateReportPrompt(input.type, enrichedTasks, {
          start: startDate,
          end: endDate
        })

        const res = await chatCompletion(config, messages, true)
        const parsed = extractJson(res.content) as {
          title: string
          summary: string
          sections: { category: string; items: string[] }[]
          highlights: string[]
          nextPlan: string[]
        }

        // Build markdown
        const typeLabel = input.type === 'daily' ? '日报' : '周报'
        const mdSections = parsed.sections
          .map((s) => `### ${s.category}\n${s.items.map((i) => `- ${i}`).join('\n')}`)
          .join('\n\n')
        const mdHighlights = parsed.highlights.map((h) => `- ${h}`).join('\n')
        const mdNextPlan = parsed.nextPlan.map((p) => `- ${p}`).join('\n')
        const markdown = `# ${parsed.title}\n\n${parsed.summary}\n\n## 工作内容\n\n${mdSections}\n\n## ${typeLabel}亮点\n\n${mdHighlights}\n\n## 下步计划\n\n${mdNextPlan}`

        return {
          success: true,
          data: { ...parsed, markdown }
        }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : '报告生成失败' }
      }
    }
  )

  // Suggest tags
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUGGEST_TAGS,
    async (_e, input: LlmSuggestTagsInput): Promise<LlmSuggestTagsResult> => {
      try {
        const config = getLlmConfig()
        const db = getDb()
        const catList = db.select().from(categories).all() as Category[]
        const tagList = db.select().from(tags).all() as Tag[]

        const messages = buildSuggestTagsPrompt(input.title, input.description, catList, tagList)
        const res = await chatCompletion(config, messages, true)
        const parsed = extractJson(res.content) as {
          categoryId: number | null
          tagIds: number[]
          newTags: string[]
        }

        // Validate categoryId
        if (parsed.categoryId !== null) {
          const exists = catList.some((c) => c.id === parsed.categoryId)
          if (!exists) parsed.categoryId = null
        }
        // Validate tagIds
        const validTagIds = new Set(tagList.map((t) => t.id))
        parsed.tagIds = (parsed.tagIds || []).filter((id) => validTagIds.has(id))
        parsed.newTags = (parsed.newTags || []).slice(0, 2)

        return { success: true, data: parsed }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : '推荐失败' }
      }
    }
  )

  // Batch parse tasks
  ipcMain.handle(
    IPC_CHANNELS.LLM_BATCH_PARSE_TASKS,
    async (_e, input: LlmBatchParseTasksInput): Promise<LlmBatchParseTasksResult> => {
      try {
        const config = getLlmConfig()
        const db = getDb()
        const catList = db.select().from(categories).all() as Category[]
        const tagList = db.select().from(tags).all() as Tag[]

        const messages = buildBatchParseTasksPrompt(input.text, catList, tagList)
        const res = await chatCompletion(config, messages, true)
        const parsed = extractJson(res.content) as {
          tasks: {
            title: string
            description: string
            priority: number
            categoryId: number | null
            dueDate: string | null
            tagIds: number[]
          }[]
        }

        const validCatIds = new Set(catList.map((c) => c.id))
        const validTagIds = new Set(tagList.map((t) => t.id))

        const validatedTasks = (parsed.tasks || []).map((t) => ({
          title: t.title || '',
          description: t.description || '',
          priority: (Math.max(0, Math.min(4, Math.round(t.priority || 0)))) as Priority,
          categoryId: t.categoryId !== null && validCatIds.has(t.categoryId) ? t.categoryId : null,
          dueDate: t.dueDate || null,
          tagIds: (t.tagIds || []).filter((id) => validTagIds.has(id))
        }))

        return { success: true, data: { tasks: validatedTasks } }
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : '批量解析失败' }
      }
    }
  )
}
