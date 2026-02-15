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
  migrateSchema()
  migrateTasksSchema()
  seedDefaults()
}

function createTables(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      icon TEXT,
      parent_id INTEGER REFERENCES categories(id),
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

function migrateSchema(): void {
  const cols = sqlite.pragma('table_info(categories)') as { name: string }[]
  const hasParentId = cols.some((c) => c.name === 'parent_id')

  if (!hasParentId) {
    // 旧表缺少 parent_id 且有 UNIQUE(name) 约束，需要重建表
    sqlite.pragma('foreign_keys = OFF')
    sqlite.exec('BEGIN TRANSACTION')
    try {
      sqlite.exec(`
        CREATE TABLE categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#6366f1',
          icon TEXT,
          parent_id INTEGER REFERENCES categories_new(id),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        )
      `)
      sqlite.exec(`
        INSERT INTO categories_new (id, name, color, icon, sort_order, created_at)
        SELECT id, name, color, icon, sort_order, created_at FROM categories
      `)
      sqlite.exec('DROP TABLE categories')
      sqlite.exec('ALTER TABLE categories_new RENAME TO categories')
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id)')
      sqlite.exec('COMMIT')
    } catch (e) {
      sqlite.exec('ROLLBACK')
      throw e
    }
    sqlite.pragma('foreign_keys = ON')
  } else {
    // 已有 parent_id 列，但可能仍有 UNIQUE(name) 约束需要移除
    const indexList = sqlite.pragma('index_list(categories)') as {
      name: string
      unique: number
    }[]
    const hasNameUnique = indexList.some((idx) => {
      if (!idx.unique) return false
      const idxCols = sqlite.pragma(`index_info(${idx.name})`) as { name: string }[]
      return idxCols.length === 1 && idxCols[0].name === 'name'
    })
    if (hasNameUnique) {
      sqlite.pragma('foreign_keys = OFF')
      sqlite.exec('BEGIN TRANSACTION')
      try {
        sqlite.exec(`
          CREATE TABLE categories_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1',
            icon TEXT,
            parent_id INTEGER REFERENCES categories_new(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
          )
        `)
        sqlite.exec(`
          INSERT INTO categories_new (id, name, color, icon, parent_id, sort_order, created_at)
          SELECT id, name, color, icon, parent_id, sort_order, created_at FROM categories
        `)
        sqlite.exec('DROP TABLE categories')
        sqlite.exec('ALTER TABLE categories_new RENAME TO categories')
        sqlite.exec('CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id)')
        sqlite.exec('COMMIT')
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
      sqlite.pragma('foreign_keys = ON')
    } else {
      // 确保索引存在
      sqlite.exec('CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id)')
    }
  }
}

function migrateTasksSchema(): void {
  // 迁移：添加 started_at 列
  const taskCols = sqlite.pragma('table_info(tasks)') as { name: string }[]
  if (!taskCols.some((c) => c.name === 'started_at')) {
    sqlite.exec('ALTER TABLE tasks ADD COLUMN started_at TEXT')
  }
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
