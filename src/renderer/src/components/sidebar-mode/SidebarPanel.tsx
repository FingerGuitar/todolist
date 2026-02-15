import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Maximize2, Inbox, CalendarDays, List, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore, useFilterStore } from '@/stores'
import { STATUS } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'
import type { ViewType } from '@/stores'

const PRIORITY_COLORS: Record<number, string> = {
  0: 'border-l-transparent',
  1: 'border-l-green-500',
  2: 'border-l-yellow-500',
  3: 'border-l-orange-500',
  4: 'border-l-red-500'
}

const VIEW_TABS: { key: ViewType; label: string; icon: typeof Inbox }[] = [
  { key: 'inbox', label: '待办', icon: Inbox },
  { key: 'today', label: '今天', icon: CalendarDays },
  { key: 'all', label: '全部', icon: List }
]

export function SidebarPanel() {
  const { tasks, fetchTasks, createTask, toggleComplete } = useTaskStore()
  const { currentView, setView, getFilter } = useFilterStore()
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTasks(getFilter())
  }, [currentView, fetchTasks, getFilter])

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) {
      inputRef.current?.focus()
      return
    }
    await createTask({ title, dueDate: formatLocalDate() })
    setNewTitle('')
    inputRef.current?.focus()
  }, [newTitle, createTask])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">TodoList</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="打开主窗口"
          onClick={() => window.api.sidebarShowMain()}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b">
        <Input
          ref={inputRef}
          placeholder="添加任务..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 cursor-pointer"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {tasks.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              暂无任务
            </div>
          ) : (
            tasks.map((task) => {
              const isCompleted = task.status === STATUS.COMPLETED
              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 border-l-2',
                    'hover:bg-accent/50 transition-colors',
                    PRIORITY_COLORS[task.priority] ?? 'border-l-transparent'
                  )}
                >
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() => toggleComplete(task.id)}
                    className="h-3.5 w-3.5"
                  />
                  {task.priority > 0 && (
                    <Flag
                      className={cn(
                        'h-3 w-3 shrink-0',
                        task.priority === 4 && 'text-red-500',
                        task.priority === 3 && 'text-orange-500',
                        task.priority === 2 && 'text-yellow-500',
                        task.priority === 1 && 'text-green-500'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'text-xs truncate flex-1',
                      isCompleted && 'line-through opacity-50'
                    )}
                  >
                    {task.title}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* View tabs */}
      <div className="flex items-center border-t">
        {VIEW_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px]',
              'transition-colors hover:bg-accent/50',
              currentView === key
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
            )}
            onClick={() => setView(key)}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
