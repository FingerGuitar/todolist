import { useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useFilterStore, useCategoryStore, useTagStore } from '@/stores'
import type { ViewType } from '@/stores'

interface HeaderProps {
  onNewTask?: () => void
}

/** 视图类型到中文名称的映射 */
const VIEW_LABELS: Record<ViewType, string> = {
  inbox: '收件箱',
  today: '今天',
  upcoming: '即将到来',
  completed: '已完成',
  category: '分类',
  tag: '标签',
  all: '全部任务'
}

export function Header({ onNewTask }: HeaderProps) {
  const { currentView, selectedCategoryId, selectedTagId, searchQuery, setSearch } =
    useFilterStore()
  const { categories } = useCategoryStore()
  const { tags } = useTagStore()

  const viewTitle = useMemo(() => {
    if (currentView === 'category' && selectedCategoryId !== null) {
      const cat = categories.find((c) => c.id === selectedCategoryId)
      return cat?.name ?? VIEW_LABELS.category
    }
    if (currentView === 'tag' && selectedTagId !== null) {
      const tag = tags.find((t) => t.id === selectedTagId)
      return tag?.name ?? VIEW_LABELS.tag
    }
    return VIEW_LABELS[currentView]
  }, [currentView, selectedCategoryId, selectedTagId, categories, tags])

  return (
    <header className="h-14 border-b border-border px-6 flex items-center justify-between gap-4 bg-background shrink-0">
      {/* View title */}
      <h1 className="text-lg font-semibold whitespace-nowrap">{viewTitle}</h1>

      {/* Search + New task */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="搜索任务..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            className={cn('pl-9 h-9 w-56 text-sm')}
          />
        </div>
        <Button size="sm" onClick={onNewTask}>
          <Plus className="h-4 w-4" />
          新建任务
        </Button>
      </div>
    </header>
  )
}
