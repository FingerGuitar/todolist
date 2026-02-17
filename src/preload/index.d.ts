import type {
  TaskWithRelations,
  TaskListFilter,
  CreateTaskInput,
  UpdateTaskInput,
  ReorderInput,
  BatchCompleteInput,
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  Tag,
  CreateTagInput,
  UpdateTagInput,
  TaskAttachment,
  AppSettings,
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
  LlmBatchParseTasksResult
} from '../shared/types'

export interface ElectronAPI {
  platform: NodeJS.Platform

  // Tasks
  taskList(filter?: TaskListFilter): Promise<TaskWithRelations[]>
  taskGet(id: number): Promise<TaskWithRelations | null>
  taskCreate(input: CreateTaskInput): Promise<TaskWithRelations>
  taskUpdate(input: UpdateTaskInput): Promise<TaskWithRelations>
  taskDelete(id: number): Promise<{ success: boolean }>
  taskReorder(items: ReorderInput[]): Promise<{ success: boolean }>
  taskToggleComplete(id: number): Promise<TaskWithRelations | null>
  taskBatchComplete(input: BatchCompleteInput): Promise<TaskWithRelations[]>
  taskBatchDelete(ids: number[]): Promise<{ success: boolean; count: number }>

  // Categories
  categoryList(): Promise<Category[]>
  categoryCreate(input: CreateCategoryInput): Promise<Category>
  categoryUpdate(input: UpdateCategoryInput): Promise<Category>
  categoryDelete(id: number): Promise<{ success: boolean }>

  // Tags
  tagList(): Promise<Tag[]>
  tagCreate(input: CreateTagInput): Promise<Tag>
  tagUpdate(input: UpdateTagInput): Promise<Tag>
  tagDelete(id: number): Promise<{ success: boolean }>

  // Attachments
  attachmentAdd(taskId: number): Promise<TaskAttachment | null>
  attachmentList(taskId: number): Promise<TaskAttachment[]>
  attachmentDelete(id: number): Promise<{ success: boolean }>
  attachmentOpen(id: number): Promise<{ success: boolean }>
  attachmentShowInFolder(id: number): Promise<{ success: boolean }>

  // Theme
  themeGet(): Promise<{ theme: string; customColor?: string }>
  themeSet(config: { theme: string; customColor?: string }): Promise<{ success: boolean }>

  // Settings
  settingsGet(): Promise<AppSettings>
  settingsSet(settings: AppSettings): Promise<{ success: boolean }>

  // Window controls
  windowMinimize(): Promise<void>
  windowMaximize(): Promise<void>
  windowClose(): Promise<void>

  // Sidebar
  sidebarToggle(): Promise<void>
  sidebarExpand(): Promise<void>
  sidebarCollapse(): Promise<void>
  sidebarShowMain(): Promise<void>

  // LLM
  llmTest(): Promise<LlmTestResult>
  llmParseTask(input: LlmParseTaskInput): Promise<LlmParseTaskResult>
  llmDecomposeTask(input: LlmDecomposeTaskInput): Promise<LlmDecomposeTaskResult>
  llmGenerateReport(input: LlmGenerateReportInput): Promise<LlmGenerateReportResult>
  llmSuggestTags(input: LlmSuggestTagsInput): Promise<LlmSuggestTagsResult>
  llmBatchParseTasks(input: LlmBatchParseTasksInput): Promise<LlmBatchParseTasksResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
