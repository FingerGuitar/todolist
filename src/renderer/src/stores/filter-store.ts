import { create } from 'zustand'
import type { TaskListFilter, Status } from '@shared/types'
import { STATUS } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'
import { useCategoryStore, getDescendantIds } from './category-store'

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'completed' | 'category' | 'tag' | 'all'

type SortByField = TaskListFilter['sortBy'] & string
type SortOrderValue = 'asc' | 'desc'

export interface FilterState {
  currentView: ViewType
  selectedCategoryId: number | null
  selectedTagId: number | null
  searchQuery: string
  sortBy: SortByField
  sortOrder: SortOrderValue

  setView: (view: ViewType) => void
  setCategory: (id: number | null) => void
  setTag: (id: number | null) => void
  setSearch: (query: string) => void
  setSortBy: (sortBy: SortByField) => void
  setSortOrder: (order: SortOrderValue) => void
  getFilter: () => TaskListFilter
}

const ACTIVE_STATUSES: Status[] = [STATUS.TODO, STATUS.IN_PROGRESS]

export const useFilterStore = create<FilterState>()((set, get) => ({
  currentView: 'inbox',
  selectedCategoryId: null,
  selectedTagId: null,
  searchQuery: '',
  sortBy: 'priority-createdAt',
  sortOrder: 'asc',

  setView: (view) => set({ currentView: view }),

  setCategory: (id) =>
    set({ selectedCategoryId: id, currentView: 'category' }),

  setTag: (id) =>
    set({ selectedTagId: id, currentView: 'tag' }),

  setSearch: (query) => set({ searchQuery: query }),

  setSortBy: (sortBy) => set({ sortBy }),

  setSortOrder: (order) => set({ sortOrder: order }),

  getFilter: () => {
    const { currentView, selectedCategoryId, selectedTagId, searchQuery, sortBy, sortOrder } =
      get()

    const filter: TaskListFilter = { sortBy, sortOrder }

    if (searchQuery.trim()) {
      filter.search = searchQuery.trim()
    }

    switch (currentView) {
      case 'inbox':
        filter.status = ACTIVE_STATUSES
        break
      case 'today': {
        const today = formatLocalDate()
        filter.status = ACTIVE_STATUSES
        filter.dueAfter = today
        filter.dueBefore = today
        break
      }
      case 'upcoming':
        filter.status = ACTIVE_STATUSES
        filter.dueAfter = formatLocalDate()
        break
      case 'completed':
        filter.status = [STATUS.COMPLETED]
        break
      case 'category':
        if (selectedCategoryId !== null) {
          const allCategories = useCategoryStore.getState().categories
          const descendantIds = getDescendantIds(allCategories, selectedCategoryId)
          filter.categoryIds = [selectedCategoryId, ...descendantIds]
        }
        break
      case 'tag':
        if (selectedTagId !== null) {
          filter.tagIds = [selectedTagId]
        }
        break
      case 'all':
        // No status filter — show everything
        break
    }

    return filter
  }
}))
