import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Loader2, Inbox, CalendarCheck, ListChecks, Plus, X, CheckSquare, Trash2, ChevronRight, ChevronDown, FolderTree, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { toast } from 'sonner'
import { useTaskStore, useFilterStore, useCategoryStore } from '@/stores'
import type { ViewType } from '@/stores'
import { buildCategoryTree, getDescendantIds, flattenCategoryTree } from '@/stores/category-store'
import type { CategoryTreeNode } from '@/stores/category-store'
import type { TaskWithRelations } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'
import { TaskItem } from './TaskItem'

/** 层级化的任务分类树节点 */
interface TaskCategoryTree {
  categoryId: number | null
  categoryName: string
  categoryColor: string
  tasks: TaskWithRelations[]
  children: TaskCategoryTree[]
}

/** 统计子树中所有任务数 */
function countTreeTasks(node: TaskCategoryTree): number {
  let count = node.tasks.length
  for (const child of node.children) count += countTreeTasks(child)
  return count
}

/** 从分类树 + 任务列表构建层级化的任务分类树（只保留有任务的分支） */
function buildTaskCategoryTree(
  catTree: CategoryTreeNode[],
  tasksByCategory: Map<number | null, TaskWithRelations[]>
): TaskCategoryTree[] {
  function visit(node: CategoryTreeNode): TaskCategoryTree | null {
    const directTasks = tasksByCategory.get(node.id) || []
    const children: TaskCategoryTree[] = []
    for (const child of node.children) {
      const childNode = visit(child)
      if (childNode) children.push(childNode)
    }
    if (directTasks.length === 0 && children.length === 0) return null
    return {
      categoryId: node.id,
      categoryName: node.name,
      categoryColor: node.color,
      tasks: directTasks,
      children
    }
  }

  const result: TaskCategoryTree[] = []
  for (const root of catTree) {
    const node = visit(root)
    if (node) result.push(node)
  }

  // 未分类任务放最后
  const uncategorized = tasksByCategory.get(null)
  if (uncategorized && uncategorized.length > 0) {
    result.push({
      categoryId: null,
      categoryName: '未分类',
      categoryColor: '#9ca3af',
      tasks: uncategorized,
      children: []
    })
  }
  return result
}

const SMART_VIEWS: Set<ViewType> = new Set(['inbox', 'today', 'upcoming', 'completed', 'all'])

const EMPTY_STATE: Record<ViewType, { icon: typeof Inbox; text: string; desc: string }> = {
  inbox: { icon: Inbox, text: '暂无待办', desc: '点击右上角按钮创建第一个任务' },
  today: { icon: CalendarCheck, text: '今天没有待办', desc: '好好享受这一天吧' },
  upcoming: { icon: CalendarCheck, text: '暂无即将到来的任务', desc: '当前没有设定截止日期的任务' },
  completed: { icon: ListChecks, text: '暂无已完成任务', desc: '完成的任务会出现在这里' },
  category: { icon: Inbox, text: '该分类下暂无任务', desc: '试试将任务添加到此分类' },
  tag: { icon: Inbox, text: '该标签下暂无任务', desc: '试试给任务添加此标签' },
  all: { icon: Inbox, text: '暂无任务', desc: '点击右上角按钮创建第一个任务' }
}

/** 内容区分类筛选节点（递归） */
function ContentCategoryNode({
  node,
  depth,
  selectedId,
  onSelect,
  collapsedIds,
  onToggleCollapse
}: {
  node: TaskCategoryTree
  depth: number
  selectedId: number | null | undefined
  onSelect: (id: number | null) => void
  collapsedIds: Set<number | null>
  onToggleCollapse: (id: number | null) => void
}) {
  const isSelected = selectedId === node.categoryId
  const totalCount = countTreeTasks(node)
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsedIds.has(node.categoryId)
  const paddingLeft = depth * 12

  return (
    <div>
      <div
        className={`flex items-center w-full py-1.5 rounded-md text-xs cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-muted font-medium' : ''}`}
        style={{ paddingLeft, paddingRight: 8 }}
      >
        <button
          type="button"
          className={`h-4 w-4 shrink-0 flex items-center justify-center ${!hasChildren ? 'invisible' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(node.categoryId)
          }}
        >
          {hasChildren && (isCollapsed
            ? <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
          )}
        </button>
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 min-w-0"
          onClick={() => onSelect(node.categoryId)}
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: node.categoryColor }}
          />
          <span className="truncate">{node.categoryName}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">{totalCount}</span>
        </button>
      </div>
      {hasChildren && !isCollapsed && node.children.map((child) => (
        <ContentCategoryNode
          key={child.categoryId ?? 'uncategorized'}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
        />
      ))}
    </div>
  )
}

/** 内容区分类筛选面板 */
function ContentCategoryFilter({
  taskTree,
  selectedId,
  onSelect,
  totalCount
}: {
  taskTree: TaskCategoryTree[]
  selectedId: number | null | undefined
  onSelect: (id: number | null | undefined) => void
  totalCount: number
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number | null>>(new Set())

  const handleToggleCollapse = useCallback((id: number | null) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <ScrollArea className="w-[180px] shrink-0 border-r border-border/30">
      <div className="pr-2 py-1">
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-muted/50 transition-colors ${selectedId === undefined ? 'bg-muted font-medium' : ''}`}
        >
          <span className="truncate">全部</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto">{totalCount}</span>
        </button>
        {taskTree.map((node) => (
          <ContentCategoryNode
            key={node.categoryId ?? 'uncategorized'}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            collapsedIds={collapsedIds}
            onToggleCollapse={handleToggleCollapse}
          />
        ))}
      </div>
    </ScrollArea>
  )
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
  const { categories } = useCategoryStore()

  const [quickTitle, setQuickTitle] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Batch selection state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false)

  // 批量分类
  const [batchCategoryOpen, setBatchCategoryOpen] = useState(false)
  const [batchCategorizing, setBatchCategorizing] = useState(false)
  const flatCategories = useMemo(
    () => flattenCategoryTree(buildCategoryTree(categories)),
    [categories]
  )

  // 内容区分类筛选（undefined=全部, null=未分类, number=具体分类）
  const [contentCategoryId, setContentCategoryId] = useState<number | null | undefined>(undefined)

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

  // Clear selection and category filter on view/filter change
  useEffect(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
    setContentCategoryId(undefined)
  }, [currentView, searchQuery, selectedCategoryId, selectedTagId, sortBy, sortOrder])

  useEffect(() => {
    fetchTasks(getFilter())
  }, [currentView, searchQuery, selectedCategoryId, selectedTagId, sortBy, sortOrder, fetchTasks, getFilter])

  const taskTree = useMemo<TaskCategoryTree[] | null>(() => {
    if (!SMART_VIEWS.has(currentView) || tasks.length === 0) return null

    const tasksByCategory = new Map<number | null, TaskWithRelations[]>()
    for (const task of tasks) {
      const key = task.categoryId
      if (!tasksByCategory.has(key)) tasksByCategory.set(key, [])
      tasksByCategory.get(key)!.push(task)
    }

    const catTree = buildCategoryTree(categories)
    return buildTaskCategoryTree(catTree, tasksByCategory)
  }, [tasks, currentView, categories])

  const isSmartView = SMART_VIEWS.has(currentView)

  const displayedTasks = useMemo(() => {
    if (!isSmartView || contentCategoryId === undefined) return tasks
    if (contentCategoryId === null) return tasks.filter((t) => t.categoryId === null)
    const descendantIds = getDescendantIds(categories, contentCategoryId)
    const validIds = new Set([contentCategoryId, ...descendantIds])
    return tasks.filter((t) => t.categoryId !== null && validIds.has(t.categoryId))
  }, [tasks, isSmartView, contentCategoryId, categories])

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

  const handleBatchUncomplete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await batchComplete(ids, false)
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

  const { updateTask } = useTaskStore()
  const handleBatchCategorize = useCallback(async (catId: number | null) => {
    setBatchCategorizing(true)
    try {
      const ids = Array.from(selectedIds)
      await Promise.all(ids.map((id) => updateTask({ id, categoryId: catId })))
      const catName = catId !== null
        ? categories.find((c) => c.id === catId)?.name ?? '未知分类'
        : '未分类'
      toast.success(`已将 ${ids.length} 个任务移到「${catName}」`)
      setSelectedIds(new Set())
      setSelectionMode(false)
      setBatchCategoryOpen(false)
    } finally {
      setBatchCategorizing(false)
    }
  }, [selectedIds, updateTask, categories])

  const batchBar = selectionMode ? (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        已选择 {selectedIds.size} 项
      </span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={selectAll}>
        全选
      </Button>
      {currentView === 'completed' ? (
        <Button variant="outline" size="sm" onClick={handleBatchUncomplete}>
          <CheckSquare className="h-3.5 w-3.5 mr-1" />
          恢复
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleBatchComplete}>
          <CheckSquare className="h-3.5 w-3.5 mr-1" />
          完成
        </Button>
      )}
      <Popover open={batchCategoryOpen} onOpenChange={setBatchCategoryOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={batchCategorizing}>
            <FolderTree className="h-3.5 w-3.5 mr-1" />
            分类
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start">
          <ScrollArea className="max-h-60">
            <button
              type="button"
              className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
              onClick={() => handleBatchCategorize(null)}
            >
              无分类
            </button>
            {flatCategories.map((cat) => (
              <button
                type="button"
                key={cat.id}
                className="flex items-center gap-2 w-full rounded-sm py-1.5 pr-2 text-sm cursor-pointer hover:bg-accent"
                style={{ paddingLeft: `${8 + cat.depth * 16}px` }}
                onClick={() => handleBatchCategorize(cat.id)}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBatchDeleteConfirmOpen(true)}>
        <Trash2 className="h-3.5 w-3.5 mr-1" />
        删除
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : null

  const currentCategory = currentView === 'category' && selectedCategoryId !== null
    ? categories.find((c) => c.id === selectedCategoryId)
    : null
  const quickAddPlaceholder = currentCategory
    ? `在「${currentCategory.name}」下添加任务，按回车确认...`
    : '输入任务标题，按回车快速添加...'

  const quickAddBar = currentView === 'completed' ? (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
      <span className="flex-1 text-sm text-muted-foreground">已完成 {tasks.length} 项</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSelectionMode(true)}
      >
        <CheckSquare className="h-3.5 w-3.5 mr-1" />
        批量操作
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-border/50">
      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        placeholder={quickAddPlaceholder}
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
      {isSmartView && taskTree && taskTree.length > 0 ? (
        <div className="flex h-full">
          <ContentCategoryFilter
            taskTree={taskTree}
            selectedId={contentCategoryId}
            onSelect={setContentCategoryId}
            totalCount={tasks.length}
          />
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-full">
              <div className="pl-3">
                {batchBar ?? quickAddBar}
                <div className="space-y-1">
                  {displayedTasks.map(renderTaskItem)}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <ScrollArea className="h-full">
          {batchBar ?? quickAddBar}
          <div className="space-y-1">
            {tasks.map(renderTaskItem)}
          </div>
        </ScrollArea>
      )}

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
