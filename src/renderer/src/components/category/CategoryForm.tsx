import { useState, useEffect } from 'react'
import {
  Briefcase,
  User,
  BookOpen,
  Home,
  Heart,
  Star,
  Folder,
  Code
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useCategoryStore } from '@/stores'
import type { Category } from '@shared/types'

const PRESET_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#14b8a6'
]

interface IconOption {
  name: string
  icon: LucideIcon
  label: string
}

const ICON_OPTIONS: IconOption[] = [
  { name: 'briefcase', icon: Briefcase, label: '公文包' },
  { name: 'user', icon: User, label: '个人' },
  { name: 'book-open', icon: BookOpen, label: '书本' },
  { name: 'home', icon: Home, label: '家' },
  { name: 'heart', icon: Heart, label: '心' },
  { name: 'star', icon: Star, label: '星' },
  { name: 'folder', icon: Folder, label: '文件夹' },
  { name: 'code', icon: Code, label: '代码' }
]

interface CategoryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  parentId?: number | null
}

export function CategoryForm({ open, onOpenChange, category, parentId }: CategoryFormProps) {
  const { createCategory, updateCategory } = useCategoryStore()
  const isEditing = !!category

  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [icon, setIcon] = useState('briefcase')

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '')
      setColor(category?.color ?? PRESET_COLORS[0])
      setIcon(category?.icon ?? 'briefcase')
    }
  }, [open, category])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (isEditing) {
      await updateCategory({ id: category.id, name: trimmed, color, icon })
    } else {
      await createCategory({ name: trimmed, color, icon, parentId: parentId ?? null })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑分类' : parentId ? '新建子分类' : '新建分类'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? '修改分类的名称、颜色和图标'
              : parentId
                ? '在当前分类下创建一个子分类'
                : '创建一个新的分类来组织任务'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 名称 */}
          <div className="space-y-2">
            <Label htmlFor="category-name">名称</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分类名称"
              autoFocus
              required
            />
          </div>

          {/* 颜色 */}
          <div className="space-y-2">
            <Label>颜色</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-6 h-6 rounded-full cursor-pointer transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background'
                  )}
                  style={{
                    backgroundColor: c,
                    ...(color === c ? { '--tw-ring-color': c } as React.CSSProperties : {})
                  }}
                />
              ))}
            </div>
          </div>

          {/* 图标 */}
          <div className="space-y-2">
            <Label>图标</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ name: iconName, icon: IconComp, label }) => (
                <button
                  key={iconName}
                  type="button"
                  title={label}
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-md cursor-pointer transition-all',
                    'border border-input hover:bg-accent',
                    icon === iconName && 'bg-accent ring-2 ring-primary ring-offset-1 ring-offset-background'
                  )}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? '保存修改' : parentId ? '创建子分类' : '创建分类'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
