import { create } from 'zustand'
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput
} from '@shared/types'

// 树节点类型
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
}

// 从扁平数组构建树
export function buildCategoryTree(cats: Category[]): CategoryTreeNode[] {
  const map = new Map<number, CategoryTreeNode>()
  const roots: CategoryTreeNode[] = []

  for (const cat of cats) {
    map.set(cat.id, { ...cat, children: [] })
  }

  for (const cat of cats) {
    const node = map.get(cat.id)!
    if (cat.parentId !== null && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// 收集某个分类及其所有后代的 ID（带 visited 防循环）
export function getDescendantIds(cats: Category[], parentId: number): number[] {
  const ids: number[] = []
  const visited = new Set<number>()
  function collect(pid: number): void {
    for (const cat of cats) {
      if (cat.parentId === pid && !visited.has(cat.id)) {
        visited.add(cat.id)
        ids.push(cat.id)
        collect(cat.id)
      }
    }
  }
  collect(parentId)
  return ids
}

/** 扁平化分类树，带深度信息（用于层级下拉选择） */
export interface FlatCategoryItem {
  id: number
  name: string
  color: string
  depth: number
}

export function flattenCategoryTree(nodes: CategoryTreeNode[], depth = 0): FlatCategoryItem[] {
  const result: FlatCategoryItem[] = []
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, color: node.color, depth })
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, depth + 1))
    }
  }
  return result
}

/** 获取分类的完整路径（从根到叶，用分隔符连接） */
export function getCategoryPath(categoryId: number, categories: Category[], separator = '-'): string {
  const path: string[] = []
  let currentId: number | null = categoryId
  const visited = new Set<number>()

  while (currentId !== null) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const cat = categories.find((c) => c.id === currentId)
    if (!cat) break
    path.unshift(cat.name)
    currentId = cat.parentId
  }

  return path.join(separator)
}

export interface CategoryState {
  categories: Category[]
  loading: boolean

  fetchCategories: () => Promise<void>
  createCategory: (input: CreateCategoryInput) => Promise<Category>
  updateCategory: (input: UpdateCategoryInput) => Promise<Category>
  deleteCategory: (id: number) => Promise<void>
  /** 在指定分类下创建 年/月/w周 日期文件夹，返回周文件夹的 id */
  createDateFolder: (parentCategoryId: number) => Promise<number>
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
    set((s) => {
      const deletedIds = new Set([id, ...getDescendantIds(s.categories, id)])
      return { categories: s.categories.filter((c) => !deletedIds.has(c.id)) }
    })
  },

  createDateFolder: async (parentCategoryId) => {
    const now = new Date()
    const year = String(now.getFullYear())
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const weekOfMonth = Math.ceil(now.getDate() / 7)
    const weekLabel = `w${weekOfMonth}`

    const { createCategory } = useCategoryStore.getState()

    // 查找或创建 年
    let cats = useCategoryStore.getState().categories
    let yearCat = cats.find((c) => c.parentId === parentCategoryId && c.name === year)
    if (!yearCat) {
      yearCat = await createCategory({ name: year, parentId: parentCategoryId })
    }

    // 查找或创建 月
    cats = useCategoryStore.getState().categories
    let monthCat = cats.find((c) => c.parentId === yearCat!.id && c.name === month)
    if (!monthCat) {
      monthCat = await createCategory({ name: month, parentId: yearCat!.id })
    }

    // 查找或创建 周
    cats = useCategoryStore.getState().categories
    let weekCat = cats.find((c) => c.parentId === monthCat!.id && c.name === weekLabel)
    if (!weekCat) {
      weekCat = await createCategory({ name: weekLabel, parentId: monthCat!.id })
    }

    return weekCat!.id
  }
}))
