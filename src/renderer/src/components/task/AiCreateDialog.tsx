import { useState, useEffect, useCallback } from 'react'
import { Loader2, Flag, CalendarDays, Trash2, FolderClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { useTaskStore, useCategoryStore, useTagStore } from '@/stores'
import type { Priority } from '@shared/types'
import { formatLocalDate } from '@shared/date-utils'

const PRIORITY_LABELS: Record<number, string> = {
  0: '', 1: '低', 2: '中', 3: '高', 4: '紧急'
}
const PRIORITY_COLORS: Record<number, string> = {
  0: '', 1: 'text-green-500', 2: 'text-yellow-500', 3: 'text-orange-500', 4: 'text-red-500'
}

interface ParsedTask {
  title: string
  description: string
  priority: Priority
  categoryId: number | null
  dueDate: string | null
  tagIds: number[]
  selected: boolean
}

interface AiCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiCreateDialog({ open, onOpenChange }: AiCreateDialogProps) {
  const createTask = useTaskStore((s) => s.createTask)
  const { categories, fetchCategories, createDateFolder } = useCategoryStore()
  const { tags, fetchTags } = useTagStore()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taskList, setTaskList] = useState<ParsedTask[]>([])
  const [creating, setCreating] = useState(false)
  const [autoCreateFolder, setAutoCreateFolder] = useState(false)

  useEffect(() => {
    if (open) {
      if (categories.length === 0) fetchCategories()
      if (tags.length === 0) fetchTags()
    }
  }, [open, categories.length, tags.length, fetchCategories, fetchTags])

  useEffect(() => {
    if (!open) {
      setInput('')
      setTaskList([])
      setError('')
      setLoading(false)
    }
  }, [open])

  const handleParse = useCallback(async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setError('')
    setTaskList([])
    try {
      const result = await window.api.llmBatchParseTasks({ text: input.trim() })
      if (result.success && result.data && result.data.tasks.length > 0) {
        setTaskList(result.data.tasks.map((t) => ({ ...t, selected: true })))
      } else {
        setError(result.error || '未能解析出任务')
      }
    } catch {
      setError('请求失败，请检查 AI 配置')
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      if (taskList.length > 0) {
        handleBatchCreate()
      } else {
        handleParse()
      }
    }
  }

  const toggleTask = (index: number) => {
    setTaskList((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    )
  }

  const updateTaskTitle = (index: number, title: string) => {
    setTaskList((prev) =>
      prev.map((t, i) => (i === index ? { ...t, title } : t))
    )
  }

  const removeTask = (index: number) => {
    setTaskList((prev) => prev.filter((_, i) => i !== index))
  }

  const selectedCount = taskList.filter((t) => t.selected).length

  const handleBatchCreate = async () => {
    const selected = taskList.filter((t) => t.selected && t.title.trim())
    if (selected.length === 0 || creating) return
    setCreating(true)
    try {
      // 如果开启日期文件夹，为每个有分类的任务创建 年/月/w周 文件夹
      // 同一个 categoryId 只需创建一次，缓存结果
      const folderCache = new Map<number, number>()
      for (const task of selected) {
        let categoryId = task.categoryId
        if (autoCreateFolder && categoryId !== null) {
          if (!folderCache.has(categoryId)) {
            const weekFolderId = await createDateFolder(categoryId)
            folderCache.set(categoryId, weekFolderId)
          }
          categoryId = folderCache.get(categoryId)!
        }
        await createTask({
          title: task.title.trim(),
          description: task.description || undefined,
          priority: task.priority,
          categoryId,
          dueDate: task.dueDate,
          tagIds: task.tagIds.length > 0 ? task.tagIds : undefined
        })
      }
      onOpenChange(false)
    } finally {
      setCreating(false)
    }
  }

  const getCategoryName = (id: number | null) => {
    if (id === null) return null
    return categories.find((c) => c.id === id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 批量创建任务</DialogTitle>
          <DialogDescription className="sr-only">
            用自然语言描述，AI 自动拆解为多个任务
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2" onKeyDown={handleKeyDown}>
          {/* 输入区 */}
          <div className="grid gap-2">
            <Label>描述你要做的事</Label>
            <Textarea
              placeholder={"例如：\n1. 明天前完成项目方案，优先级高\n2. 下周三提交设计稿给产品部\n3. 周五前整理本月报销单\n\n也可以用一段话描述，AI 会自动拆解"}
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Ctrl+Enter 快捷操作</span>
              <Button
                size="sm"
                className="h-7"
                onClick={handleParse}
                disabled={!input.trim() || loading}
              >
                {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {loading ? 'AI 解析中...' : 'AI 解析'}
              </Button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* 解析结果列表 */}
          {taskList.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    解析出 {taskList.length} 个任务，已选 {selectedCount} 个
                  </Label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={autoCreateFolder}
                        onCheckedChange={(v) => setAutoCreateFolder(!!v)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <FolderClock className="h-3 w-3" />
                        自动归入日期文件夹
                      </span>
                    </label>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => {
                        const allSelected = taskList.every((t) => t.selected)
                        setTaskList((prev) => prev.map((t) => ({ ...t, selected: !allSelected })))
                      }}
                    >
                      {taskList.every((t) => t.selected) ? '取消全选' : '全选'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {taskList.map((task, index) => {
                    const cat = getCategoryName(task.categoryId)
                    return (
                      <div
                        key={index}
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-3 py-2 transition-opacity',
                          !task.selected && 'opacity-40'
                        )}
                      >
                        <Checkbox
                          checked={task.selected}
                          onCheckedChange={() => toggleTask(index)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTaskTitle(index, e.target.value)}
                            className="h-7 text-sm border-0 shadow-none px-0 focus-visible:ring-0"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {task.priority > 0 && (
                              <span className={cn('text-[10px] font-medium', PRIORITY_COLORS[task.priority])}>
                                <Flag className="h-2.5 w-2.5 inline mr-0.5" />
                                {PRIORITY_LABELS[task.priority]}
                              </span>
                            )}
                            {cat && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: cat.color }}
                                />
                                {cat.name}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <CalendarDays className="h-2.5 w-2.5" />
                                {task.dueDate}
                              </span>
                            )}
                            {task.tagIds.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {task.tagIds.length} 个标签
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive mt-0.5 cursor-pointer"
                          onClick={() => removeTask(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {taskList.length > 0 && (
            <Button
              onClick={handleBatchCreate}
              disabled={selectedCount === 0 || creating}
            >
              {creating ? '创建中...' : `确认创建 ${selectedCount} 个任务`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
