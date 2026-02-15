import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  icon: text('icon'),
  parentId: integer('parent_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now','localtime'))`)
})

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#8b5cf6'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now','localtime'))`)
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  priority: integer('priority').notNull().default(0),
  status: integer('status').notNull().default(0),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null'
  }),
  dueDate: text('due_date'),
  reminderAt: text('reminder_at'),
  completedAt: text('completed_at'),
  startedAt: text('started_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now','localtime'))`)
})

export const taskTags = sqliteTable(
  'task_tags',
  {
    taskId: integer('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.tagId] })
  })
)

export const taskAttachments = sqliteTable('task_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now','localtime'))`)
})
