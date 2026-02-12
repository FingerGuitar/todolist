import { useMemo } from 'react'
import { useTaskStore } from '@/stores'
import { STATUS } from '@shared/types'

export function StatusBar() {
  const tasks = useTaskStore((s) => s.tasks)

  const { todoCount, overdueCount } = useMemo(() => {
    const now = new Date()
    let todo = 0
    let overdue = 0

    for (const task of tasks) {
      if (task.status === STATUS.TODO || task.status === STATUS.IN_PROGRESS) {
        todo++
        if (task.dueDate && new Date(task.dueDate) < now) {
          overdue++
        }
      }
    }

    return { todoCount: todo, overdueCount: overdue }
  }, [tasks])

  return (
    <footer className="h-8 border-t border-border px-6 flex items-center justify-between text-xs text-muted-foreground bg-background shrink-0">
      <span>
        {todoCount} 个待办
        {overdueCount > 0 && (
          <span className="text-destructive"> · {overdueCount} 个逾期</span>
        )}
      </span>
      <span className="opacity-60">Ctrl+N 新建任务</span>
    </footer>
  )
}
