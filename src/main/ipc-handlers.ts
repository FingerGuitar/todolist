import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { eq, and, or, like, inArray, lte, gte, asc, desc, sql, count } from 'drizzle-orm'
import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, unlinkSync, statSync } from 'fs'
import { randomUUID } from 'crypto'
import { extname, basename } from 'path'
import { getDb } from './database'
import { tasks, categories, tags, taskTags, taskAttachments } from '../shared/schema'
import { IPC_CHANNELS } from '../shared/types'
import { formatLocalDateTime } from '../shared/date-utils'
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskListFilter,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTagInput,
  UpdateTagInput,
  ReorderInput,
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
      if (filter.categoryId !== undefined) {
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
    const colMap = {
      createdAt: tasks.createdAt,
      dueDate: tasks.dueDate,
      priority: tasks.priority,
      sortOrder: tasks.sortOrder,
      title: tasks.title
    } as const
    const column = colMap[sortCol] ?? tasks.sortOrder
    query = query.orderBy(sortDir === 'desc' ? desc(column) : asc(column))

    const rows = query.all() as Task[]
    return rows.map(enrichTask)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_GET, (_e, id: number) => {
    const task = db.select().from(tasks).where(eq(tasks.id, id)).get() as Task | undefined
    if (!task) return null
    return enrichTask(task)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, (_e, input: CreateTaskInput) => {
    const result = db
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 0,
        status: input.status ?? 0,
        categoryId: input.categoryId ?? null,
        dueDate: input.dueDate ?? null,
        reminderAt: input.reminderAt ?? null
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

  // ---- Categories ----

  ipcMain.handle(IPC_CHANNELS.CATEGORY_LIST, () => {
    return db.select().from(categories).orderBy(asc(categories.sortOrder)).all()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_CREATE, (_e, input: CreateCategoryInput) => {
    return db
      .insert(categories)
      .values({
        name: input.name,
        color: input.color ?? '#6366f1',
        icon: input.icon ?? null
      })
      .returning()
      .get()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_UPDATE, (_e, input: UpdateCategoryInput) => {
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.color !== undefined) updates.color = input.color
    if (input.icon !== undefined) updates.icon = input.icon
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder
    db.update(categories).set(updates).where(eq(categories.id, input.id)).run()
    return db.select().from(categories).where(eq(categories.id, input.id)).get()
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORY_DELETE, (_e, id: number) => {
    db.delete(categories).where(eq(categories.id, id)).run()
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
    return getThemeConfig()
  })

  ipcMain.handle(IPC_CHANNELS.THEME_SET, (_e, config: { theme: string; customColor?: string }) => {
    saveThemeConfig(config)
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

// ---- Theme config helpers ----

function getThemeConfigPath(): string {
  return join(app.getPath('userData'), 'theme.json')
}

function getThemeConfig(): { theme: string; customColor?: string } {
  const configPath = getThemeConfigPath()
  if (existsSync(configPath)) {
    try {
      const data = require('fs').readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return { theme: 'default-light' }
    }
  }
  return { theme: 'default-light' }
}

function saveThemeConfig(config: { theme: string; customColor?: string }): void {
  const configPath = getThemeConfigPath()
  require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
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
