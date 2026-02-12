import { useEffect } from 'react'
import { Loader2, Inbox, CalendarCheck, ListChecks } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore, useFilterStore } from '@/stores'
import type { ViewType } from '@/stores'
import type { TaskWithRelations } from '@shared/types'
import { TaskItem } from './TaskItem'

const EMPTY_STATE: Record<ViewType, { icon: typeof Inbox; text: string; desc: string }> = {
  inbox: { icon: Inbox, text: '收件箱为空', desc: '点击右上角按钮创建第一个任务' },
  today: { icon: CalendarCheck, text: '今天没有待办', desc: '好好享受这一天吧' },
  upcoming: { icon: CalendarCheck, text: '暂无即将到来的任务', desc: '当前没有设定截止日期的任务' },
  completed: { icon: ListChecks, text: '暂无已完成任务', desc: '完成的任务会出现在这里' },
  category: { icon: Inbox, text: '该分类下暂无任务', desc: '试试将任务添加到此分类' },
  tag: { icon: Inbox, text: '该标签下暂无任务', desc: '试试给任务添加此标签' },
  all: { icon: Inbox, text: '暂无任务', desc: '点击右上角按钮创建第一个任务' }
}

interface TaskListProps {
  onEditTask: (task: TaskWithRelations) => void
}

export function TaskList({ onEditTask }: TaskListProps) {
  const { tasks, loading, fetchTasks } = useTaskStore()
  const {
    currentView, searchQuery, selectedCategoryId, selectedTagId,
    sortBy, sortOrder, getFilter
  } = useFilterStore()

  useEffect(() => {
    fetchTasks(getFilter())
  }, [currentView, searchQuery, selectedCategoryId, selectedTagId, sortBy, sortOrder, fetchTasks, getFilter])

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (tasks.length === 0) {
    const empty = EMPTY_STATE[currentView] ?? EMPTY_STATE.all
    const Icon = empty.icon
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">{empty.text}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{empty.desc}</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onEdit={onEditTask} />
        ))}
      </div>
    </ScrollArea>
  )
}
