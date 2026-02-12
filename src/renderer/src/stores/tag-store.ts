import { create } from 'zustand'
import type { Tag, CreateTagInput, UpdateTagInput } from '@shared/types'

export interface TagState {
  tags: Tag[]
  loading: boolean

  fetchTags: () => Promise<void>
  createTag: (input: CreateTagInput) => Promise<Tag>
  updateTag: (input: UpdateTagInput) => Promise<Tag>
  deleteTag: (id: number) => Promise<void>
}

export const useTagStore = create<TagState>()((set) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true })
    try {
      const tags = await window.api.tagList()
      set({ tags, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createTag: async (input) => {
    const tag = await window.api.tagCreate(input)
    set((s) => ({ tags: [...s.tags, tag] }))
    return tag
  },

  updateTag: async (input) => {
    const updated = await window.api.tagUpdate(input)
    set((s) => ({
      tags: s.tags.map((t) => (t.id === updated.id ? updated : t))
    }))
    return updated
  },

  deleteTag: async (id) => {
    await window.api.tagDelete(id)
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== id)
    }))
  }
}))
