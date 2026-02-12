import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../shared/schema'

let db: ReturnType<typeof drizzle<typeof schema>>
let sqlite: Database.Database

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbDir = userDataPath
  const dbPath = join(dbDir, 'data.db')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  sqlite = new Database(dbPath)

  // Performance & safety pragmas
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  db = drizzle(sqlite, { schema })

  createTables()
  seedDefaults()
}

function createTables(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      due_date TEXT,
      reminder_at TEXT,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
  `)
}

function seedDefaults(): void {
  const catCount = sqlite
    .prepare('SELECT COUNT(*) as count FROM categories')
    .get() as { count: number }
  if (catCount.count === 0) {
    const insert = sqlite.prepare(
      'INSERT INTO categories (name, color, icon, sort_order) VALUES (?, ?, ?, ?)'
    )
    insert.run('工作', '#3b82f6', 'briefcase', 0)
    insert.run('个人', '#22c55e', 'user', 1)
    insert.run('学习', '#f59e0b', 'book-open', 2)
  }

  const tagCount = sqlite
    .prepare('SELECT COUNT(*) as count FROM tags')
    .get() as { count: number }
  if (tagCount.count === 0) {
    const insert = sqlite.prepare(
      'INSERT INTO tags (name, color) VALUES (?, ?)'
    )
    insert.run('紧急', '#ef4444')
    insert.run('重要', '#f97316')
    insert.run('审查', '#8b5cf6')
  }
}

export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
  }
}
