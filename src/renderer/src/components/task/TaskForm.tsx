import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTaskStore, useCategoryStore, useTagStore, useSettingsStore } from '@/stores'
import type { TaskWithRelations, Priority } from '@shared/types'
import { formatLocalDate, formatDuration } from '@shared/date-utils'

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: '无' },
  { value: '1', label: '低' },
  { value: '2', label: '中' },
  { value: '3', label: '高' },
  { value: '4', label: '紧急' }
]

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations | null
  defaultCategoryId?: number
}

export function TaskForm({ open, onOpenChange, task, defaultCategoryId }: TaskFormProps) {
  const createTask = useTaskStore((s) => s.createTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const { categories, fetchCategories } = useCategoryStore()
  const { tags, fetchTags } = useTagStore()
  const showDuration = useSettingsStore((s) => s.settings.showTaskDuration)

  const isEdit = !!task

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('0')
  const [categoryId, setCategoryId] = useState<string>('none')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [submitting, setSubmitting] = useState(false)

  // Load categories/tags if not yet loaded
  useEffect(() => {
    if (open) {
      if (categories.length === 0) fetchCategories()
      if (tags.length === 0) fetchTags()
    }
  }, [open, categories.length, tags.length, fetchCategories, fetchTags])

  // Reset form when opening
  useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(String(task.priority))
      setCategoryId(task.categoryId ? String(task.categoryId) : 'none')
      setSelectedTagIds(task.tags.map((t) => t.id))
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined)
    } else {
      setTitle('')
      setDescription('')
      setPriority('0')
      setCategoryId(defaultCategoryId ? String(defaultCategoryId) : 'none')
      setSelectedTagIds([])
      setDueDate(new Date())
    }
  }, [open, task])

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }, [])

  const handleSubmit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      const catId = categoryId === 'none' ? null : Number(categoryId)
      const due = dueDate ? formatLocalDate(dueDate) : null

      if (isEdit) {
        await updateTask({
          id: task.id,
          title: title.trim(),
          description,
          priority: Number(priority) as Priority,
          categoryId: catId,
          dueDate: due,
          tagIds: selectedTagIds
        })
      } else {
        await createTask({
          title: title.trim(),
          description: description || undefined,
          priority: Number(priority) as Priority,
          categoryId: catId,
          dueDate: due,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined
        })
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? '修改任务信息' : '填写任务信息以创建新任务'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="task-title">标题 *</Label>
            <Input
              id="task-title"
              placeholder="输入任务标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="task-desc">描述</Label>
            <Textarea
              id="task-desc"
              placeholder="添加任务描述..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority + Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>优先级</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>分类</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="grid gap-2">
              <Label>标签</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal h-10">
                    {selectedTagIds.length > 0
                      ? `已选 ${selectedTagIds.length} 个标签`
                      : '选择标签'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="grid gap-1">
                    {tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Due date */}
          <div className="grid gap-2">
            <Label>截止日期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal h-10',
                    !dueDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'yyyy年M月d日', { locale: zhCN }) : '选择日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  locale={zhCN}
                />
                {dueDate && (
                  <div className="border-t px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setDueDate(undefined)}
                    >
                      清除日期
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 任务用时信息（编辑模式 + 开关开启时显示） */}
        {isEdit && showDuration && (task?.startedAt || task?.completedAt) && (
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            {task.startedAt && <div>开始时间：{task.startedAt}</div>}
            {task.completedAt && <div>完成时间：{task.completedAt}</div>}
            {task.startedAt && task.completedAt && (
              <div>总用时：{formatDuration(task.startedAt, task.completedAt)}</div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || submitting}>
            {isEdit ? '保存修改' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
