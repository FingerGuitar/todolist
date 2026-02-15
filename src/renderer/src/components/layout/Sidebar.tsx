import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Inbox,
  CalendarDays,
  Clock,
  CheckCircle2,
  Plus,
  Settings,
  CheckSquare,
  Briefcase,
  User,
  BookOpen,
  Tag as TagIcon,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  FolderPlus,
  ListPlus,
  Pencil,
  Trash2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
import { useFilterStore, useCategoryStore, useTagStore } from '@/stores'
import type { ViewType } from '@/stores'
import { buildCategoryTree, getDescendantIds } from '@/stores/category-store'
import type { CategoryTreeNode } from '@/stores/category-store'

/** 将 Category.icon 字符串映射到 lucide 图标 */
const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  user: User,
  'book-open': BookOpen,
  inbox: Inbox,
  calendar: CalendarDays,
  clock: Clock,
  check: CheckCircle2
}

function getCategoryIcon(iconName: string | null): LucideIcon {
  if (!iconName) return Briefcase
  return ICON_MAP[iconName] ?? Briefcase
}

interface NavItemProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}

function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
        'text-sm',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

interface SmartView {
  view: ViewType
  icon: LucideIcon
  label: string
}

const SMART_VIEWS: SmartView[] = [
  { view: 'inbox', icon: Inbox, label: '待办' },
  { view: 'today', icon: CalendarDays, label: '今天' },
  { view: 'upcoming', icon: Clock, label: '即将到来' },
  { view: 'completed', icon: CheckCircle2, label: '已完成' }
]

interface SidebarProps {
  onAddCategory?: (parentId?: number) => void
  onEditCategory?: (categoryId: number) => void
  onAddTag?: () => void
  onNewTask?: (categoryId?: number) => void
  onOpenSettings?: () => void
}

/** 递归渲染分类树节点 */
function CategoryTreeItem({
  node,
  depth,
  currentView,
  selectedCategoryId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onAddChild,
  onEditCategory,
  onDeleteCategory,
  onNewTask
}: {
  node: CategoryTreeNode
  depth: number
  currentView: string
  selectedCategoryId: number | null
  expandedIds: Set<number>
  onToggleExpand: (id: number) => void
  onSelect: (id: number) => void
  onAddChild: (parentId: number) => void
  onEditCategory: (id: number) => void
  onDeleteCategory: (id: number, name: string, hasChildren: boolean) => void
  onNewTask: (categoryId: number) => void
}) {
  const isActive = currentView === 'category' && selectedCategoryId === node.id
  const hasChildren = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const Icon = getCategoryIcon(node.icon)
  const paddingLeft = 12 + depth * 16

  return (
    <>
      <div
        className={cn(
          'group flex w-full items-center gap-1.5 py-1.5 rounded-md cursor-pointer',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
          'text-sm',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
        )}
        style={{ paddingLeft, paddingRight: 8 }}
      >
        {/* 折叠/展开按钮 */}
        <button
          type="button"
          className={cn(
            'h-4 w-4 shrink-0 flex items-center justify-center rounded-sm',
            'hover:bg-sidebar-accent',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(node.id)
          }}
        >
          {hasChildren &&
            (isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            ))}
        </button>

        {/* 分类内容（可点击选中） */}
        <button
          type="button"
          className="flex flex-1 items-center gap-2 min-w-0"
          onClick={() => onSelect(node.id)}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: node.color }}
          />
          <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="truncate">{node.name}</span>
        </button>

        {/* hover 显示三点菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-5 w-5 shrink-0 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-40">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => onNewTask(node.id)}
            >
              <ListPlus className="h-3.5 w-3.5" />
              新建待办任务
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => onAddChild(node.id)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              新建子分类
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => onEditCategory(node.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑分类
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
              onClick={() => onDeleteCategory(node.id, node.name, hasChildren)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除分类
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 递归渲染子节点 */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentView={currentView}
              selectedCategoryId={selectedCategoryId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEditCategory={onEditCategory}
              onDeleteCategory={onDeleteCategory}
              onNewTask={onNewTask}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function Sidebar({ onAddCategory, onEditCategory, onAddTag, onNewTask, onOpenSettings }: SidebarProps) {
  const { currentView, selectedCategoryId, selectedTagId, setView, setCategory, setTag } =
    useFilterStore()
  const { categories, fetchCategories, deleteCategory } = useCategoryStore()
  const { tags, fetchTags } = useTagStore()

  // 折叠/展开状态
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: number
    name: string
    hasChildren: boolean
  } | null>(null)

  useEffect(() => {
    fetchCategories()
    fetchTags()
  }, [fetchCategories, fetchTags])

  // 构建分类树
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories])

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectCategory = useCallback((id: number) => {
    setCategory(id)
  }, [setCategory])

  const handleAddChild = useCallback((parentId: number) => {
    onAddCategory?.(parentId)
  }, [onAddCategory])

  const handleEditCategory = useCallback((id: number) => {
    onEditCategory?.(id)
  }, [onEditCategory])

  const handleDeleteCategory = useCallback((id: number, name: string, hasChildren: boolean) => {
    setDeleteConfirm({ id, name, hasChildren })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return
    // 如果当前选中的分类被删除（含后代），重置到 inbox
    if (currentView === 'category' && selectedCategoryId !== null) {
      const allDeletedIds = new Set([deleteConfirm.id, ...getDescendantIds(categories, deleteConfirm.id)])
      if (allDeletedIds.has(selectedCategoryId)) {
        setView('inbox')
      }
    }
    await deleteCategory(deleteConfirm.id)
    setDeleteConfirm(null)
  }, [deleteConfirm, deleteCategory, currentView, selectedCategoryId, categories, setView])

  const handleNewTaskInCategory = useCallback((categoryId: number) => {
    onNewTask?.(categoryId)
  }, [onNewTask])

  return (
    <aside className="flex flex-col w-[260px] bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 shrink-0">
        <CheckSquare className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">TodoList</span>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {/* Smart Views */}
          <SectionHeader label="智能视图" />
          <nav className="flex flex-col gap-0.5">
            {SMART_VIEWS.map(({ view, icon, label }) => (
              <NavItem
                key={view}
                icon={icon}
                label={label}
                active={currentView === view}
                onClick={() => setView(view)}
              />
            ))}
          </nav>

          {/* Categories */}
          <div className="flex items-center justify-between mt-4 mb-2 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              分类
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-sidebar-foreground"
              onClick={() => onAddCategory?.()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {categoryTree.map((node) => (
              <CategoryTreeItem
                key={node.id}
                node={node}
                depth={0}
                currentView={currentView}
                selectedCategoryId={selectedCategoryId}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onSelect={handleSelectCategory}
                onAddChild={handleAddChild}
                onEditCategory={handleEditCategory}
                onDeleteCategory={handleDeleteCategory}
                onNewTask={handleNewTaskInCategory}
              />
            ))}
          </nav>

          {/* 新建分类入口 */}
          <button
            type="button"
            onClick={() => onAddCategory?.()}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
              'text-sm text-muted-foreground'
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>新建分类</span>
          </button>

          {/* Tags */}
          <div className="flex items-center justify-between mt-4 mb-2 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              标签
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-sidebar-foreground"
              onClick={onAddTag}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {tags.map((tag) => {
              const isActive =
                currentView === 'tag' && selectedTagId === tag.id
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setView('tag')
                    setTag(tag.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
                    'text-sm',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  )}
                >
                  <TagIcon className="h-3.5 w-3.5 shrink-0" style={{ color: tag.color }} />
                  <span className="truncate" style={{ color: isActive ? undefined : tag.color }}>
                    {tag.name}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </ScrollArea>

      {/* Settings */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-sidebar-foreground"
          onClick={() => onOpenSettings?.()}
        >
          <Settings className="h-4 w-4" />
          <span>设置</span>
        </Button>
      </div>
      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.hasChildren
                ? `确定要删除分类「${deleteConfirm?.name}」及其所有子分类吗？该操作不可撤销，相关任务将变为未分类。`
                : `确定要删除分类「${deleteConfirm?.name}」吗？该操作不可撤销，相关任务将变为未分类。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-4 mb-2 block">
      {label}
    </span>
  )
}
