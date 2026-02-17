import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { eq, and, or, like, inArray, lt, lte, gte, asc, desc, sql, count } from 'drizzle-orm'
import { join, extname, basename } from 'path'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, statSync } from 'fs'
import { randomUUID } from 'crypto'
import { getDb } from './database'
import { loadSettings, saveSettings } from './settings'
import { tasks, categories, tags, taskTags, taskAttachments } from '../shared/schema'
import { IPC_CHANNELS, STATUS } from '../shared/types'
import type { AppSettings } from '../shared/types'
import { formatLocalDate, formatLocalDateTime } from '../shared/date-utils'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilter,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTagInput,
  UpdateTagInput,
  ReorderInput,
  BatchCompleteInput,
  TaskWithRelations,
  Task,
  Category,
  Tag,
  TaskAttachment
} from '../shared/types'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function getAttachmentsDir(): string {
  const dir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function now(): string {
  return formatLocalDateTime()
}

// Enrich a task row with its relations
function enrichTask(task: Task): TaskWithRelations {
  const db = getDb()
  const category = task.categoryId
    ? db.select().from(categories).where(eq(categories.id, task.categoryId)).get() ?? null
    : null
  const taskTagRows = db
    .select({ tagId: taskTags.tagId })
    .from(taskTags)
    .where(eq(taskTags.taskId, task.id))
    .all()
  const tagList =
    taskTagRows.length > 0
      ? db
          .select()
          .from(tags)
          .where(
            inArray(
              tags.id,
              taskTagRows.map((r) => r.tagId)
            )
          )
          .all()
      : []
  const [attachRow] = db
    .select({ count: count() })
    .from(taskAttachments)
    .where(eq(taskAttachments.taskId, task.id))
    .all()
  return {
    ...task,
    category: category as Category | null,
    tags: tagList as Tag[],
    attachmentCount: attachRow?.count ?? 0
  }
}

export function registerIpcHandlers(): void {
  const db = getDb()

  // ---- Tasks ----

  ipcMain.handle(IPC_CHANNELS.TASK_LIST, (_e, filter?: TaskListFilter) => {
    // 自动延期：将逾期未完成任务的 dueDate 更新为今天（可通过设置关闭）
    const appSettings = loadSettings()
    if (appSettings.autoPostponeOverdue) {
      const today = formatLocalDate()
      db.update(tasks)
        .set({ dueDate: today, updatedAt: formatLocalDateTime() })
        .where(
          and(
            inArray(tasks.status, [STATUS.TODO, STATUS.IN_PROGRESS]),
            lt(tasks.dueDate, today),
            sql`${tasks.dueDate} IS NOT NULL`
          )
        )
        .run()
    }

    let query = db.select().from(tasks).$dynamic()
    const conditions: ReturnType<typeof eq>[] = []

    if (filter) {
      if (filter.status !== undefined) {
        if (Array.isArray(filter.status)) {
          conditions.push(inArray(tasks.status, filter.status))
        } else {
          conditions.push(eq(tasks.status, filter.status))
        }
      }
      if (filter.priority !== undefined) {
        if (Array.isArray(filter.priority)) {
          conditions.push(inArray(tasks.priority, filter.priority))
        } else {
          conditions.push(eq(tasks.priority, filter.priority))
        }
      }
      if (filter.categoryIds && filter.categoryIds.length > 0) {
        conditions.push(inArray(tasks.categoryId, filter.categoryIds))
      } else if (filter.categoryId !== undefined) {
        if (filter.categoryId === null) {
          conditions.push(sql`${tasks.categoryId} IS NULL`)
        } else {
          conditions.push(eq(tasks.categoryId, filter.categoryId))
        }
      }
      if (filter.search) {
        const term = `%${filter.search}%`
        conditions.push(
          or(like(tasks.title, term), like(tasks.description, term))!
        )
      }
      if (filter.dueBefore) {
        conditions.push(lte(tasks.dueDate, filter.dueBefore))
      }
      if (filter.dueAfter) {
        conditions.push(gte(tasks.dueDate, filter.dueAfter))
      }
    }

    // Tag filter: resolve M:N join into task IDs, then merge into conditions
    if (filter?.tagIds && filter.tagIds.length > 0) {
      const matchingTaskIds = db
        .select({ taskId: taskTags.taskId })
        .from(taskTags)
        .where(inArray(taskTags.tagId, filter.tagIds))
        .all()
        .map((r) => r.taskId)
      if (matchingTaskIds.length === 0) {
        return []
      }
      conditions.push(inArray(tasks.id, matchingTaskIds))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    const sortCol = filter?.sortBy ?? 'sortOrder'
    const sortDir = filter?.sortOrder ?? 'asc'

    if (sortCol === 'priority-createdAt') {
      query = query.orderBy(desc(tasks.priority), asc(tasks.createdAt))
    } else {
      const colMap = {
        createdAt: tasks.createdAt,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
        sortOrder: tasks.sortOrder,
        title: tasks.title
      } as const
      const column = colMap[sortCol] ?? tasks.sortOrder
      query = query.orderBy(sortDir === 'desc' ? desc(column) : asc(column))
    }

    const rows = query.all() as Task[]
    return rows.map(enrichTask)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_GET, (_e, id: number) => {
    const task = db.select().from(tasks).where(eq(tasks.id, id)).get() as Task | undefined
    if (!task) return null
    return enrichTask(task)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, (_e, input: CreateTaskInput) => {
    const status = input.status ?? 0
    const result = db
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 0,
        status,
        categoryId: input.categoryId ?? null,
        dueDate: input.dueDate ?? null,
        reminderAt: input.reminderAt ?? null,
        startedAt: status === 1 ? now() : null
      })
      .returning()
      .get() as Task

    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        db.insert(taskTags).values({ taskId: result.id, tagId }).run()
      }
    }

    return enrichTask(result)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, (_e, input: UpdateTaskInput) => {
    const updates: Record<string, unknown> = { updatedAt: now() }
    if (input.title !== undefined) updates.title = input.title
    if (input.description !== undefined) updates.description = input.description
    if (input.priority !== undefined) updates.priority = input.priority
    if (input.status !== undefined) {
      updates.status = input.status
      if (input.status === 2) {
        updates.completedAt = now()
      } else {
        updates.completedAt = null
      }
      // 首次进入进行中时记录开始时间
      if (input.status === 1) {
        const current = db.select().from(tasks).where(eq(tasks.id, input.id)).get() as Task | undefined
        if (current && !current.startedAt) {
          updates.startedAt = now()
        }
      }
    }
    if (input.categoryId !== undefined) updates.categoryId = input.categoryId
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate
    if (input.reminderAt !== undefined) updates.reminderAt = input.reminderAt

    db.update(tasks).set(updates).where(eq(tasks.id, input.id)).run()

    if (input.tagIds !== undefined) {
      db.delete(taskTags).where(eq(taskTags.taskId, input.id)).run()
      for (const tagId of input.tagIds) {
        db.insert(taskTags).values({ taskId: input.id, tagId }).run()
      }
    }

    const updated = db.select().from(tasks).where(eq(tasks.id, input.id)).get() as Task
    return enrichTask(updated)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, (_e, id: number) => {
    // Clean up attachment files
    const attachments = db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, id))
      .all() as TaskAttachment[]
    const attachDir = getAttachmentsDir()
    for (const att of attachments) {
      const filePath = join(attachDir, att.filename)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }
    db.delete(tasks).where(eq(tasks.id, id)).run()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TASK_REORDER, (_e, items: ReorderInput[]) => {
    for (const item of items) {
      db.update(tasks)
        .set({ sortOrder: item.sortOrder, updatedAt: now() })
        .where(eq(tasks.id, item.id))
        .run()
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TASK_TOGGLE_COMPLETE, (_e, id: number) => {
    const task = db.select().from(tasks).where(eq(tasks.id, id)).get() as Task | undefined
    if (!task) return null
    const newStatus = task.status === 2 ? 0 : 2
    const completedAt = newStatus === 2 ? now() : null
    db.update(tasks)
      .set({ status: newStatus, completedAt, updatedAt: now() })
      .where(eq(tasks.id, id))
      .run()
    const updated = db.select().from(tasks).where(eq(tasks.id, id)).get() as Task
    return enrichTask(updated)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_BATCH_COMPLETE, (_e, input: BatchCompleteInput) => {
    const { ids, complete } = input
    if (ids.length === 0) return []
    const status = complete ? STATUS.COMPLETED : STATUS.TODO
    const completedAt = complete ? now() : null
    db.update(tasks)
      .set({ status, completedAt, updatedAt: now() })
      .where(inArray(tasks.id, ids))
      .run()
    const rows = db.select().from(tasks).where(inArray(tasks.id, ids)).all() as Task[]
    return rows.map(enrichTask)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_BATCH_DELETE, (_e, ids: number[]) => {
    if (ids.length === 0) return { success: true, count: 0 }
    // Clean up attachment files
    const attachments = db
      .select()
      .from(taskAttachments)
      .where(inArray(taskAttachments.taskId, ids))
      .all() as TaskAttachment[]
    const attachDir = getAttachmentsDir()
    for (const att of attachments) {
      const filePath = join(attachDir, att.filename)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
    }
    db.delete(tasks).where(inArray(tasks.id, ids)).run()
    return { success: true, count: ids.length }
  })

  // ---- Categories ----

  // 检查同级分类名称是否重复
  function checkCategoryNameUnique(name: string, parentId: number | null, excludeId?: number): void {
    const condition = parentId === null
      ? sql`${categories.parentId} IS NULL`
      : eq(categories.parentId, parentId)
    const siblings = db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(condition, eq(categories.name, name)))
      .all()
    const conflict = excludeId
      ? siblings.find((s) => s.id !== excludeId)
      : siblings[0]
    if (conflict) {
      throw new Error(`同级分类下已存在名称"${name}"`)
    }
  }

  // 检查 parentId 是否会形成循环引用
  function checkCategoryNoCycle(id: number, newParentId: number | null): void {
    if (newParentId === null) return
    if (newParentId === id) {
      throw new Error('不能将分类设为自身的子分类')
    }
    const visited = new Set<number>([id])
    let current: number | null = newParentId
    while (current !== null) {
      if (visited.has(current)) {
        throw new Error('不能将分类设为其后代的子分类，会形成循环引用')
      }
      visited.add(current)
      const row = db
        .select({ parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.id, current))
        .get() as { parentId: number | null } | undefined
      current = row?.parentId ?? null
    }
  }

  ipcMain.handle(IPC_CHANNELS.CATEGORY_LIST, () => {
    return db.select().from(categories).orderBy(asc(categories.sortOrder)).all()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_CREATE, (_e, input: CreateCategoryInput) => {
    const parentId = input.parentId ?? null
    checkCategoryNameUnique(input.name, parentId)
    return db
      .insert(categories)
      .values({
        name: input.name,
        color: input.color ?? '#6366f1',
        icon: input.icon ?? null,
        parentId
      })
      .returning()
      .get()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_UPDATE, (_e, input: UpdateCategoryInput) => {
    // 循环引用校验
    if (input.parentId !== undefined) {
      checkCategoryNoCycle(input.id, input.parentId ?? null)
    }
    // 同级名称唯一校验
    if (input.name !== undefined) {
      const current = db.select().from(categories).where(eq(categories.id, input.id)).get() as
        | { parentId: number | null }
        | undefined
      const effectiveParentId = input.parentId !== undefined
        ? (input.parentId ?? null)
        : (current?.parentId ?? null)
      checkCategoryNameUnique(input.name, effectiveParentId, input.id)
    }

    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.color !== undefined) updates.color = input.color
    if (input.icon !== undefined) updates.icon = input.icon
    if (input.parentId !== undefined) updates.parentId = input.parentId
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder
    db.update(categories).set(updates).where(eq(categories.id, input.id)).run()
    return db.select().from(categories).where(eq(categories.id, input.id)).get()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_DELETE, (_e, id: number) => {
    // 递归删除子分类（带 visited 防御循环）
    function deleteCategoryRecursive(catId: number, visited: Set<number>): void {
      if (visited.has(catId)) return
      visited.add(catId)
      const children = db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, catId))
        .all()
      for (const child of children) {
        deleteCategoryRecursive(child.id, visited)
      }
      db.delete(categories).where(eq(categories.id, catId)).run()
    }
    deleteCategoryRecursive(id, new Set())
    return { success: true }
  })

  // ---- Tags ----

  ipcMain.handle(IPC_CHANNELS.TAG_LIST, () => {
    return db.select().from(tags).orderBy(asc(tags.name)).all()
  })

  ipcMain.handle(IPC_CHANNELS.TAG_CREATE, (_e, input: CreateTagInput) => {
    return db
      .insert(tags)
      .values({
        name: input.name,
        color: input.color ?? '#8b5cf6'
      })
      .returning()
      .get()
  })

  ipcMain.handle(IPC_CHANNELS.TAG_UPDATE, (_e, input: UpdateTagInput) => {
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.color !== undefined) updates.color = input.color
    db.update(tags).set(updates).where(eq(tags.id, input.id)).run()
    return db.select().from(tags).where(eq(tags.id, input.id)).get()
  })

  ipcMain.handle(IPC_CHANNELS.TAG_DELETE, (_e, id: number) => {
    db.delete(tags).where(eq(tags.id, id)).run()
    return { success: true }
  })

  // ---- Attachments ----

  ipcMain.handle(IPC_CHANNELS.ATTACHMENT_ADD, async (_e, taskId: number) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const stat = statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`文件大小超过 50MB 限制`)
    }

    const ext = extname(filePath)
    const originalName = basename(filePath)
    const filename = `${randomUUID()}${ext}`
    const destDir = getAttachmentsDir()
    copyFileSync(filePath, join(destDir, filename))

    const mime = getMimeType(ext)
    const attachment = db
      .insert(taskAttachments)
      .values({
        taskId,
        filename,
        originalName,
        mimeType: mime,
        size: stat.size
      })
      .returning()
      .get()
    return attachment
  })

  ipcMain.handle(IPC_CHANNELS.ATTACHMENT_LIST, (_e, taskId: number) => {
    return db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.taskId, taskId))
      .orderBy(desc(taskAttachments.createdAt))
      .all()
  })

  ipcMain.handle(IPC_CHANNELS.ATTACHMENT_DELETE, (_e, id: number) => {
    const att = db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, id))
      .get() as TaskAttachment | undefined
    if (att) {
      const filePath = join(getAttachmentsDir(), att.filename)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      db.delete(taskAttachments).where(eq(taskAttachments.id, id)).run()
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.ATTACHMENT_OPEN, (_e, id: number) => {
    const att = db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, id))
      .get() as TaskAttachment | undefined
    if (att) {
      shell.openPath(join(getAttachmentsDir(), att.filename))
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.ATTACHMENT_SHOW_IN_FOLDER, (_e, id: number) => {
    const att = db
      .select()
      .from(taskAttachments)
      .where(eq(taskAttachments.id, id))
      .get() as TaskAttachment | undefined
    if (att) {
      shell.showItemInFolder(join(getAttachmentsDir(), att.filename))
    }
    return { success: true }
  })

  // ---- Theme ----

  ipcMain.handle(IPC_CHANNELS.THEME_GET, () => {
    const settings = loadSettings()
    return { theme: settings.theme, customColor: settings.customColor }
  })

  ipcMain.handle(IPC_CHANNELS.THEME_SET, (_e, config: { theme: string; customColor?: string }) => {
    const settings = loadSettings()
    settings.theme = config.theme
    settings.customColor = config.customColor
    saveSettings(settings)
    return { success: true }
  })

  // ---- Settings ----

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return loadSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_e, settings: AppSettings) => {
    saveSettings(settings)
    // 同步开机自启动
    app.setLoginItemSettings({ openAtLogin: settings.autoLaunch })
    return { success: true }
  })

  // ---- Window ----

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize()
    }
  })

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.hide()
  })
}

// ---- MIME type helper ----

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime'
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
