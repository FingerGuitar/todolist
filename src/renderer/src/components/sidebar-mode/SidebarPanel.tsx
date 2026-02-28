import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, Maximize2, Inbox, CalendarDays, List, Flag, PanelLeft, PanelTop, PanelRight, GripVertical, GripHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore, useFilterStore, useCategoryStore } from '@/stores'
import { getCategoryPath } from '@/stores/category-store'
import { STATUS } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'
import type { ViewType } from '@/stores'
import type { TaskWithRelations } from '@shared/types'

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

interface CategoryGroup {
  key: string
  path: string
  color: string
  tasks: TaskWithRelations[]
}

interface SidebarPanelProps {
  edge: 'top' | 'left' | 'right'
  onDragStateChange?: (dragging: boolean) => void
}

export function SidebarPanel({ edge, onDragStateChange }: SidebarPanelProps) {
  const { tasks, fetchTasks, createTask, toggleComplete } = useTaskStore()
  const { currentView, setView, getFilter } = useFilterStore()
  const categories = useCategoryStore((s) => s.categories)
  const { fetchCategories } = useCategoryStore()
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ lastPos: number } | null>(null)

  const isHorizontal = edge === 'top'

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { lastPos: isHorizontal ? e.screenX : e.screenY }
      onDragStateChange?.(true)

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        const pos = isHorizontal ? ev.screenX : ev.screenY
        const delta = pos - dragRef.current.lastPos
        if (delta !== 0) {
          dragRef.current.lastPos = pos
          window.api.sidebarDragMove(delta)
        }
      }

      const handleUp = () => {
        dragRef.current = null
        onDragStateChange?.(false)
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [isHorizontal, onDragStateChange]
  )

  useEffect(() => {
    fetchTasks(getFilter())
    fetchCategories()
  }, [currentView, fetchTasks, getFilter, fetchCategories])

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

  // 按分类分组
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, CategoryGroup>()

    for (const task of tasks) {
      const key = task.categoryId != null ? String(task.categoryId) : '__uncategorized__'
      if (!groups.has(key)) {
        const path = task.category
          ? getCategoryPath(task.category.id, categories)
          : '未分类'
        const color = task.category?.color ?? '#9ca3af'
        groups.set(key, { key, path, color, tasks: [] })
      }
      groups.get(key)!.tasks.push(task)
    }

    // 未分类放最后
    const result: CategoryGroup[] = []
    const uncategorized = groups.get('__uncategorized__')
    groups.delete('__uncategorized__')
    for (const group of groups.values()) result.push(group)
    if (uncategorized) result.push(uncategorized)
    return result
  }, [tasks, categories])

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header — entire bar is draggable */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1">
          <div className="p-0.5 text-muted-foreground">
            {isHorizontal
              ? <GripHorizontal className="h-4 w-4" />
              : <GripVertical className="h-4 w-4" />}
          </div>
          <span className="text-sm font-semibold">TodoList</span>
        </div>
        <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
          {([
            { edge: 'left', icon: PanelLeft, title: '停靠左侧' },
            { edge: 'top', icon: PanelTop, title: '停靠顶部' },
            { edge: 'right', icon: PanelRight, title: '停靠右侧' }
          ] as const).map(({ edge: e, icon: Icon, title }) => (
            <Button
              key={e}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={title}
              onClick={() => window.api.sidebarChangeEdge(e)}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
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

      {/* Task list grouped by category */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {tasks.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              暂无任务
            </div>
          ) : (
            groupedTasks.map((group) => (
              <div key={group.key}>
                {/* Category header */}
                <div className="flex items-center gap-1.5 px-3 py-1 mt-1 first:mt-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground truncate">
                    {group.path}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {group.tasks.length}
                  </span>
                </div>
                {/* Tasks */}
                {group.tasks.map((task) => {
                  const isCompleted = task.status === STATUS.COMPLETED
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center gap-2 px-3 pl-6 py-1.5 border-l-2',
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
                })}
              </div>
            ))
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
