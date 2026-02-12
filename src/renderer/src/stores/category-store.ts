import { create } from 'zustand'
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput
} from '@shared/types'

export interface CategoryState {
  categories: Category[]
  loading: boolean

  fetchCategories: () => Promise<void>
  createCategory: (input: CreateCategoryInput) => Promise<Category>
  updateCategory: (input: UpdateCategoryInput) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
}

export const useCategoryStore = create<CategoryState>()((set) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true })
    try {
      const categories = await window.api.categoryList()
      set({ categories, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  createCategory: async (input) => {
    const category = await window.api.categoryCreate(input)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  updateCategory: async (input) => {
    const updated = await window.api.categoryUpdate(input)
    set((s) => ({
      categories: s.categories.map((c) => (c.id === updated.id ? updated : c))
    }))
    return updated
  },

  deleteCategory: async (id) => {
    await window.api.categoryDelete(id)
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id)
    }))
  }
}))
