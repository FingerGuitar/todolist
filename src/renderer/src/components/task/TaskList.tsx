import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Loader2, Inbox, CalendarCheck, ListChecks, Plus, X, CheckSquare, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useTaskStore, useFilterStore } from '@/stores'
import type { ViewType } from '@/stores'
import type { TaskWithRelations } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'
import { TaskItem } from './TaskItem'

interface TaskGroup {
  categoryId: number | null
  categoryName: string
  categoryColor: string
  tasks: TaskWithRelations[]
}

const GROUPED_VIEWS: Set<ViewType> = new Set(['inbox', 'today', 'upcoming', 'completed', 'all'])

const EMPTY_STATE: Record<ViewType, { icon: typeof Inbox; text: string; desc: string }> = {
  inbox: { icon: Inbox, text: '暂无待办', desc: '点击右上角按钮创建第一个任务' },
  today: { icon: CalendarCheck, text: '今天没有待办', desc: '好好享受这一天吧' },
  upcoming: { icon: CalendarCheck, text: '暂无即将到来的任务', desc: '当前没有设定截止日期的任务' },
  completed: { icon: ListChecks, text: '暂无已完成任务', desc: '完成的任务会出现在这里' },
  category: { icon: Inbox, text: '该分类下暂无任务', desc: '试试将任务添加到此分类' },
  tag: { icon: Inbox, text: '该标签下暂无任务', desc: '试试给任务添加此标签' },
  all: { icon: Inbox, text: '暂无任务', desc: '点击右上角按钮创建第一个任务' }
}

interface TaskListProps {
  onEditTask: (task: TaskWithRelations) => void
  onDecomposeTask?: (task: TaskWithRelations) => void
}

export function TaskList({ onEditTask, onDecomposeTask }: TaskListProps) {
  const { tasks, loading, fetchTasks, createTask, batchComplete, batchDelete } = useTaskStore()
  const {
    currentView, searchQuery, selectedCategoryId, selectedTagId,
    sortBy, sortOrder, getFilter
  } = useFilterStore()

  const [quickTitle, setQuickTitle] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false)

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(tasks.map((t) => t.id)))
  }, [tasks])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [])

  // Clear selection on view/filter change
  useEffect(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [currentView, searchQuery, selectedCategoryId, selectedTagId, sortBy, sortOrder])

  useEffect(() => {
    fetchTasks(getFilter())
  }, [currentView, searchQuery, selectedCategoryId, selectedTagId, sortBy, sortOrder, fetchTasks, getFilter])

  const groupedTasks = useMemo<TaskGroup[] | null>(() => {
    if (!GROUPED_VIEWS.has(currentView) || tasks.length === 0) return null

    const groupMap = new Map<number | null, TaskGroup>()
    for (const task of tasks) {
      const key = task.categoryId
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          categoryId: key,
          categoryName: task.category?.name ?? '未分类',
          categoryColor: task.category?.color ?? '#9ca3af',
          tasks: []
        })
      }
      groupMap.get(key)!.tasks.push(task)
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.categoryId === null) return 1
      if (b.categoryId === null) return -1
      return a.categoryName.localeCompare(b.categoryName)
    })
  }, [tasks, currentView])

  const handleQuickAdd = useCallback(async () => {
    const title = quickTitle.trim()
    if (!title || quickAdding) return
    setQuickAdding(true)
    try {
      // 如果当前在分类视图下，自动关联分类
      const categoryId = currentView === 'category' && selectedCategoryId !== null
        ? selectedCategoryId
        : undefined
      await createTask({
        title,
        categoryId: categoryId ?? null,
        dueDate: formatLocalDate()
      })
      setQuickTitle('')
      inputRef.current?.focus()
    } finally {
      setQuickAdding(false)
    }
  }, [quickTitle, quickAdding, currentView, selectedCategoryId, createTask])

  const handleBatchComplete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchComplete(ids, true)
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [selectedIds, batchComplete])

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchDelete(ids)
    setSelectedIds(new Set())
    setSelectionMode(false)
    setBatchDeleteConfirmOpen(false)
  }, [selectedIds, batchDelete])

  const batchBar = selectionMode ? (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        已选择 {selectedIds.size} 项
      </span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={selectAll}>
        全选
      </Button>
      <Button variant="outline" size="sm" onClick={handleBatchComplete}>
        <CheckSquare className="h-3.5 w-3.5 mr-1" />
        完成
      </Button>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBatchDeleteConfirmOpen(true)}>
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        删除
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : null

  const quickAddBar = (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        placeholder="输入任务标题，按回车快速添加..."
        value={quickTitle}
        onChange={(e) => setQuickTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            handleQuickAdd()
          }
        }}
        disabled={quickAdding}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground"
        title="批量选择"
        onClick={() => setSelectionMode(true)}
      >
        <CheckSquare className="h-4 w-4" />
      </Button>
    </div>
  )

  if (loading && tasks.length === 0) {
    return (
      <div>
        {quickAddBar}
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    const empty = EMPTY_STATE[currentView] ?? EMPTY_STATE.all
    const Icon = empty.icon
    return (
      <div>
        {quickAddBar}
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">{empty.text}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{empty.desc}</p>
        </div>
      </div>
    )
  }

  const renderTaskItem = (task: TaskWithRelations) => (
    <TaskItem
      key={task.id}
      task={task}
      onEdit={onEditTask}
      onDecompose={onDecomposeTask}
      selectionMode={selectionMode}
      selected={selectedIds.has(task.id)}
      onToggleSelect={toggleSelect}
    />
  )

  return (
    <>
      <ScrollArea className="h-full">
        {batchBar ?? quickAddBar}
        {groupedTasks ? (
          <div className="space-y-4">
            {groupedTasks.map((group) => (
              <div key={group.categoryId ?? 'uncategorized'}>
                <div className="flex items-center gap-2 px-1 pb-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.categoryColor }}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {group.categoryName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {group.tasks.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.tasks.map(renderTaskItem)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map(renderTaskItem)}
          </div>
        )}
      </ScrollArea>

      {/* Batch delete confirmation */}
      <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个任务吗？该操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBatchDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
