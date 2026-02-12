import { create } from 'zustand'
import type {
  TaskWithRelations,
  TaskListFilter,
  CreateTaskInput,
  UpdateTaskInput,
  ReorderInput
} from '@shared/types'

export interface TaskState {
  tasks: TaskWithRelations[]
  loading: boolean
  error: string | null

  fetchTasks: (filter?: TaskListFilter) => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<TaskWithRelations>
  updateTask: (input: UpdateTaskInput) => Promise<TaskWithRelations>
  deleteTask: (id: number) => Promise<void>
  toggleComplete: (id: number) => Promise<void>
  reorderTasks: (items: ReorderInput[]) => Promise<void>
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (filter?) => {
    set({ loading: true, error: null })
    try {
      const tasks = await window.api.taskList(filter)
      set({ tasks, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createTask: async (input) => {
    set({ loading: true, error: null })
    try {
      const task = await window.api.taskCreate(input)
      set((s) => ({ tasks: [task, ...s.tasks], loading: false }))
      return task
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  updateTask: async (input) => {
    set({ loading: true, error: null })
    try {
      const updated = await window.api.taskUpdate(input)
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === updated.id ? updated : t)),
        loading: false
      }))
      return updated
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  deleteTask: async (id) => {
    set({ loading: true, error: null })
    try {
      await window.api.taskDelete(id)
      set((s) => ({
        tasks: s.tasks.filter((t) => t.id !== id),
        loading: false
      }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  toggleComplete: async (id) => {
    set({ error: null })
    try {
      const updated = await window.api.taskToggleComplete(id)
      if (updated) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === updated.id ? updated : t))
        }))
      }
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  reorderTasks: async (items) => {
    // Optimistic update: apply new sort orders immediately
    const prev = get().tasks
    set((s) => ({
      tasks: s.tasks.map((t) => {
        const reorder = items.find((r) => r.id === t.id)
        return reorder ? { ...t, sortOrder: reorder.sortOrder } : t
      })
    }))
    try {
      await window.api.taskReorder(items)
    } catch (e) {
      // Rollback on failure
      set({ tasks: prev, error: (e as Error).message })
    }
  }
}))
