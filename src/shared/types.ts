// Priority levels
export const PRIORITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4
} as const
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY]

// Task status
export const STATUS = {
  TODO: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3
} as const
export type Status = (typeof STATUS)[keyof typeof STATUS]

// ---- Entity types ----

export interface Task {
  id: number
  title: string
  description: string
  priority: Priority
  status: Status
  categoryId: number | null
  dueDate: string | null
  reminderAt: string | null
  completedAt: string | null
  startedAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TaskWithRelations extends Task {
  category: Category | null
  tags: Tag[]
  attachmentCount: number
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string | null
  parentId: number | null
  sortOrder: number
  createdAt: string
}

export interface Tag {
  id: number
  name: string
  color: string
  createdAt: string
}

export interface TaskAttachment {
  id: number
  taskId: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

// ---- App Settings ----

export interface AppSettings {
  theme: string
  customColor?: string
  showTaskDuration: boolean
  autoLaunch: boolean
  closeToTray: boolean
  confirmBeforeDelete: boolean
  autoPostponeOverdue: boolean
  sloganStyle: 'off' | 'programmer' | 'motivational' | 'sarcastic' | 'literary' | 'funny'
}

// ---- IPC payload types ----

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: Priority
  status?: Status
  categoryId?: number | null
  dueDate?: string | null
  reminderAt?: string | null
  tagIds?: number[]
}

export interface UpdateTaskInput {
  id: number
  title?: string
  description?: string
  priority?: Priority
  status?: Status
  categoryId?: number | null
  dueDate?: string | null
  reminderAt?: string | null
  tagIds?: number[]
}

export interface TaskListFilter {
  status?: Status | Status[]
  priority?: Priority | Priority[]
  categoryId?: number | null
  categoryIds?: number[]
  tagIds?: number[]
  search?: string
  dueBefore?: string
  dueAfter?: string
  sortBy?: 'createdAt' | 'dueDate' | 'priority' | 'sortOrder' | 'title' | 'priority-createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateCategoryInput {
  name: string
  color?: string
  icon?: string | null
  parentId?: number | null
}

export interface UpdateCategoryInput {
  id: number
  name?: string
  color?: string
  icon?: string | null
  parentId?: number | null
  sortOrder?: number
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  id: number
  name?: string
  color?: string
}

export interface ReorderInput {
  id: number
  sortOrder: number
}

// ---- IPC Channel names ----

export const IPC_CHANNELS = {
  // Tasks
  TASK_LIST: 'task:list',
  TASK_GET: 'task:get',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_REORDER: 'task:reorder',
  TASK_TOGGLE_COMPLETE: 'task:toggle-complete',
  // Categories
  CATEGORY_LIST: 'category:list',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_UPDATE: 'category:update',
  CATEGORY_DELETE: 'category:delete',
  // Tags
  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',
  TAG_UPDATE: 'tag:update',
  TAG_DELETE: 'tag:delete',
  // Attachments
  ATTACHMENT_ADD: 'attachment:add',
  ATTACHMENT_LIST: 'attachment:list',
  ATTACHMENT_DELETE: 'attachment:delete',
  ATTACHMENT_OPEN: 'attachment:open',
  ATTACHMENT_SHOW_IN_FOLDER: 'attachment:show-in-folder',
  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  // Sidebar
  SIDEBAR_TOGGLE: 'sidebar:toggle',
  SIDEBAR_EXPAND: 'sidebar:expand',
  SIDEBAR_COLLAPSE: 'sidebar:collapse',
  SIDEBAR_SHOW_MAIN: 'sidebar:show-main'
} as const
