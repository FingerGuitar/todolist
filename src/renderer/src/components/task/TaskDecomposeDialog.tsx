import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { useTaskStore } from '@/stores'
import type { TaskWithRelations, Priority } from '@shared/types'

interface SubtaskItem {
  title: string
  description: string
  priority: Priority
  selected: boolean
}

interface TaskDecomposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskWithRelations | null
}

export function TaskDecomposeDialog({ open, onOpenChange, task }: TaskDecomposeDialogProps) {
  const createTask = useTaskStore((s) => s.createTask)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open && task) {
      handleDecompose()
    }
    if (!open) {
      setSubtasks([])
      setError('')
      setLoading(false)
    }
  }, [open, task?.id])

  const handleDecompose = async () => {
    if (!task) return
    setLoading(true)
    setError('')
    try {
      const result = await window.api.llmDecomposeTask({ taskId: task.id })
      if (result.success && result.data) {
        setSubtasks(
          result.data.subtasks.map((s) => ({
            ...s,
            selected: true
          }))
        )
      } else {
        setError(result.error || '拆解失败')
      }
    } catch {
      setError('请求失败，请检查 AI 配置')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const selected = subtasks.filter((s) => s.selected)
    if (selected.length === 0 || creating) return
    setCreating(true)
    try {
      for (const sub of selected) {
        await createTask({
          title: sub.title,
          description: sub.description || undefined,
          priority: sub.priority,
          categoryId: task?.categoryId ?? undefined
        })
      }
      onOpenChange(false)
    } finally {
      setCreating(false)
    }
  }

  const toggleSubtask = (index: number) => {
    setSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    )
  }

  const updateTitle = (index: number, title: string) => {
    setSubtasks((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title } : s))
    )
  }

  const selectedCount = subtasks.filter((s) => s.selected).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI 拆解子任务</DialogTitle>
          <DialogDescription className="sr-only">将任务拆解为子任务</DialogDescription>
        </DialogHeader>

        {task && (
          <p className="text-sm text-muted-foreground">
            父任务：{task.title}
          </p>
        )}

        <div className="py-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">AI 正在拆解任务...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={handleDecompose}>
                重试
              </Button>
            </div>
          )}

          {!loading && !error && subtasks.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {subtasks.map((sub, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    checked={sub.selected}
                    onCheckedChange={() => toggleSubtask(index)}
                  />
                  <Input
                    value={sub.title}
                    onChange={(e) => updateTitle(index, e.target.value)}
                    className="h-7 text-sm border-0 shadow-none px-1 focus-visible:ring-0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {subtasks.length > 0 && (
            <Button
              onClick={handleCreate}
              disabled={selectedCount === 0 || creating}
            >
              {creating ? '创建中...' : `创建 ${selectedCount} 个子任务`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
