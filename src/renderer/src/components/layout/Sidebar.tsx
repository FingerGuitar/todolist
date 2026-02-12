import { useEffect } from 'react'
import {
  Inbox,
  CalendarDays,
  Clock,
  CheckCircle2,
  Plus,
  Palette,
  CheckSquare,
  Briefcase,
  User,
  BookOpen,
  Tag as TagIcon
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useFilterStore, useCategoryStore, useTagStore, useThemeStore } from '@/stores'
import type { ViewType } from '@/stores'
import { themeCategories, themes } from '@/themes'

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
  { view: 'inbox', icon: Inbox, label: '收件箱' },
  { view: 'today', icon: CalendarDays, label: '今天' },
  { view: 'upcoming', icon: Clock, label: '即将到来' },
  { view: 'completed', icon: CheckCircle2, label: '已完成' }
]

interface SidebarProps {
  onAddCategory?: () => void
  onAddTag?: () => void
}

export function Sidebar({ onAddCategory, onAddTag }: SidebarProps) {
  const { currentView, selectedCategoryId, selectedTagId, setView, setCategory, setTag } =
    useFilterStore()
  const { categories, fetchCategories } = useCategoryStore()
  const { tags, fetchTags } = useTagStore()
  const { currentTheme, setTheme } = useThemeStore()

  useEffect(() => {
    fetchCategories()
    fetchTags()
  }, [fetchCategories, fetchTags])

  const currentThemeLabel = themes[currentTheme]?.label ?? currentTheme

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
              onClick={onAddCategory}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {categories.map((cat) => {
              const isActive =
                currentView === 'category' && selectedCategoryId === cat.id
              const Icon = getCategoryIcon(cat.icon)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setView('category')
                    setCategory(cat.id)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 rounded-md cursor-pointer',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
                    'text-sm',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <Icon className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="truncate">{cat.name}</span>
                </button>
              )
            })}
          </nav>

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

      {/* Theme Switcher */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm text-sidebar-foreground"
            >
              <Palette className="h-4 w-4" />
              <span className="truncate">{currentThemeLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            {themeCategories.map((group, groupIndex) => (
              <DropdownMenuGroup key={group.key}>
                {groupIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.themes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.name}
                    onClick={() => setTheme(theme.name)}
                    className={cn(
                      'cursor-pointer',
                      currentTheme === theme.name && 'bg-accent font-medium'
                    )}
                  >
                    <span
                      className="mr-2 h-3 w-3 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                    />
                    {theme.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
