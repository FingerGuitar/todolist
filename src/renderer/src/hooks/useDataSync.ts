import { useEffect } from 'react'
import { useTaskStore, useCategoryStore, useTagStore, useFilterStore } from '@/stores'

/**
 * 监听主进程的 data-changed 广播，跨窗口同步数据。
 * 应在 App 根组件中调用一次。
 */
export function useDataSync(): void {
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const fetchCategories = useCategoryStore((s) => s.fetchCategories)
  const fetchTags = useTagStore((s) => s.fetchTags)

  useEffect(() => {
    const cleanup = window.api.onDataChanged((entity) => {
      const filter = useFilterStore.getState().getFilter()
      if (entity === 'task') {
        fetchTasks(filter)
      } else if (entity === 'category') {
        fetchCategories()
      } else if (entity === 'tag') {
        fetchTags()
      }
    })
    return cleanup
  }, [fetchTasks, fetchCategories, fetchTags])
}
