import { useState, useEffect } from 'react'
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
import { useTagStore } from '@/stores'
import type { Tag } from '@shared/types'

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

interface TagFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: Tag | null
}

export function TagForm({ open, onOpenChange, tag }: TagFormProps) {
  const { createTag, updateTag } = useTagStore()
  const isEditing = !!tag

  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  useEffect(() => {
    if (open) {
      setName(tag?.name ?? '')
      setColor(tag?.color ?? PRESET_COLORS[0])
    }
  }, [open, tag])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (isEditing) {
      await updateTag({ id: tag.id, name: trimmed, color })
    } else {
      await createTag({ name: trimmed, color })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑标签' : '新建标签'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改标签的名称和颜色' : '创建一个新的标签来标记任务'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 名称 */}
          <div className="space-y-2">
            <Label htmlFor="tag-name">名称</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                #
              </span>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入标签名称"
                className="pl-7"
                autoFocus
                required
              />
            </div>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? '保存修改' : '创建标签'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
