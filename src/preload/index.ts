import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,

  // Tasks
  taskList: (filter?: unknown) => ipcRenderer.invoke('task:list', filter),
  taskGet: (id: number) => ipcRenderer.invoke('task:get', id),
  taskCreate: (input: unknown) => ipcRenderer.invoke('task:create', input),
  taskUpdate: (input: unknown) => ipcRenderer.invoke('task:update', input),
  taskDelete: (id: number) => ipcRenderer.invoke('task:delete', id),
  taskReorder: (items: unknown) => ipcRenderer.invoke('task:reorder', items),
  taskToggleComplete: (id: number) => ipcRenderer.invoke('task:toggle-complete', id),
  taskBatchComplete: (input: unknown) => ipcRenderer.invoke('task:batch-complete', input),
  taskBatchDelete: (ids: number[]) => ipcRenderer.invoke('task:batch-delete', ids),

  // Categories
  categoryList: () => ipcRenderer.invoke('category:list'),
  categoryCreate: (input: unknown) => ipcRenderer.invoke('category:create', input),
  categoryUpdate: (input: unknown) => ipcRenderer.invoke('category:update', input),
  categoryDelete: (id: number) => ipcRenderer.invoke('category:delete', id),

  // Tags
  tagList: () => ipcRenderer.invoke('tag:list'),
  tagCreate: (input: unknown) => ipcRenderer.invoke('tag:create', input),
  tagUpdate: (input: unknown) => ipcRenderer.invoke('tag:update', input),
  tagDelete: (id: number) => ipcRenderer.invoke('tag:delete', id),

  // Attachments
  attachmentAdd: (taskId: number) => ipcRenderer.invoke('attachment:add', taskId),
  attachmentList: (taskId: number) => ipcRenderer.invoke('attachment:list', taskId),
  attachmentDelete: (id: number) => ipcRenderer.invoke('attachment:delete', id),
  attachmentOpen: (id: number) => ipcRenderer.invoke('attachment:open', id),
  attachmentShowInFolder: (id: number) => ipcRenderer.invoke('attachment:show-in-folder', id),

  // Theme
  themeGet: () => ipcRenderer.invoke('theme:get'),
  themeSet: (config: unknown) => ipcRenderer.invoke('theme:set', config),

  // Settings
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),

  // Sidebar
  sidebarToggle: () => ipcRenderer.invoke('sidebar:toggle'),
  sidebarExpand: () => ipcRenderer.invoke('sidebar:expand'),
  sidebarCollapse: () => ipcRenderer.invoke('sidebar:collapse'),
  sidebarShowMain: () => ipcRenderer.invoke('sidebar:show-main'),
  sidebarChangeEdge: (edge: string) => ipcRenderer.invoke('sidebar:change-edge', edge),
  sidebarDragMove: (delta: number) => ipcRenderer.send('sidebar:drag-move', delta),

  // LLM
  llmTest: () => ipcRenderer.invoke('llm:test'),
  llmParseTask: (input: unknown) => ipcRenderer.invoke('llm:parse-task', input),
  llmDecomposeTask: (input: unknown) => ipcRenderer.invoke('llm:decompose-task', input),
  llmGenerateReport: (input: unknown) => ipcRenderer.invoke('llm:generate-report', input),
  llmSuggestTags: (input: unknown) => ipcRenderer.invoke('llm:suggest-tags', input),
  llmBatchParseTasks: (input: unknown) => ipcRenderer.invoke('llm:batch-parse-tasks', input)
}

export type ElectronAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API via contextBridge:', error)
  }
} else {
  // @ts-ignore
  window.api = api
}
