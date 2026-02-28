import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MoreHorizontal, Flag, Pencil, Trash2, CalendarDays, GitBranch, Copy } from 'lucide-react'
import { format, isToday, isTomorrow, isPast, differenceInDays, startOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
import { useTaskStore, useSettingsStore } from '@/stores'
import { STATUS } from '@shared/types'
import type { TaskWithRelations } from '@shared/types'
import { formatDuration } from '@shared/date-utils'

const PRIORITY_COLORS: Record<number, string> = {
  0: 'border-l-transparent',
  1: 'border-l-green-500',
  2: 'border-l-yellow-500',
  3: 'border-l-orange-500',
  4: 'border-l-red-500'
}

const PRIORITY_LABELS: Record<number, string> = {
  0: '无', 1: '低', 2: '中', 3: '高', 4: '紧急'
}

const PRIORITY_TEXT_COLORS: Record<number, string> = {
  0: '', 1: 'text-green-500', 2: 'text-yellow-500', 3: 'text-orange-500', 4: 'text-red-500'
}

interface TaskItemProps {
  task: TaskWithRelations
  onEdit: (task: TaskWithRelations) => void
  onDecompose?: (task: TaskWithRelations) => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: number) => void
}

function formatDueDate(dueDate: string): { label: string; overdue: boolean } {
  const due = startOfDay(new Date(dueDate))
  const now = startOfDay(new Date())

  if (isToday(due)) return { label: '今天', overdue: false }
  if (isTomorrow(due)) return { label: '明天', overdue: false }

  if (isPast(due)) {
    const days = differenceInDays(now, due)
    return { label: `逾期${days}天`, overdue: true }
  }

  return { label: format(due, 'M月d日', { locale: zhCN }), overdue: false }
}

export function TaskItem({ task, onEdit, onDecompose, selectionMode, selected, onToggleSelect }: TaskItemProps) {
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const showDuration = useSettingsStore((s) => s.settings.showTaskDuration)
  const confirmBeforeDelete = useSettingsStore((s) => s.settings.confirmBeforeDelete)
  const llmEnabled = useSettingsStore((s) => s.settings.llm.enabled)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [noteText, setNoteText] = useState(task.description ?? '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isCompleted = task.status === STATUS.COMPLETED

  // Sync noteText when task.description changes externally
  useEffect(() => {
    if (!expanded) {
      setNoteText(task.description ?? '')
    }
  }, [task.description, expanded])

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [expanded])

  const saveNote = useCallback(async () => {
    const trimmed = noteText.trim()
    const original = (task.description ?? '').trim()
    if (trimmed !== original) {
      setSaving(true)
      try {
        await updateTask({ id: task.id, description: trimmed })
      } finally {
        setSaving(false)
      }
    }
  }, [noteText, task.description, task.id, updateTask])

  // Click outside to collapse (save before closing)
  useEffect(() => {
    if (!expanded) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        saveNote()
        setExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded, saveNote])

  const dueInfo = useMemo(
    () => (task.dueDate ? formatDueDate(task.dueDate) : null),
    [task.dueDate]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        'group flex gap-3 rounded-lg border-l-[3px] px-3 py-2.5',
        expanded ? 'items-start' : 'items-center',
        'transition-colors hover:bg-accent/50 cursor-pointer',
        PRIORITY_COLORS[task.priority] ?? 'border-l-transparent'
      )}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(task.id)
        } else {
          setExpanded((prev) => !prev)
        }
      }}
    >
      {/* Checkbox: selection mode → select checkbox; normal → complete checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        {selectionMode && onToggleSelect ? (
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={() => onToggleSelect(task.id)}
          />
        ) : (
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => toggleComplete(task.id)}
          />
        )}
      </div>

      {/* Priority flag + label */}
      {task.priority > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          <Flag className={cn('h-3.5 w-3.5', PRIORITY_TEXT_COLORS[task.priority])} />
          <span className={cn('text-[10px] font-medium', PRIORITY_TEXT_COLORS[task.priority])}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm truncate',
              isCompleted && 'line-through opacity-60'
            )}
          >
            {task.title}
          </span>
        </div>

        {/* Note preview (collapsed) */}
        {!expanded && task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}

        {/* Note editor (expanded) */}
        {expanded && (
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            <textarea
              ref={textareaRef}
              className={cn(
                'w-full text-xs bg-transparent border border-border rounded-md px-2 py-1.5',
                'resize-none outline-none focus:ring-1 focus:ring-ring',
                'placeholder:text-muted-foreground/60',
                saving && 'opacity-60'
              )}
              rows={3}
              placeholder="添加备注..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={saveNote}
              disabled={saving}
            />
          </div>
        )}

        {/* Tags + Category */}
        {(task.tags.length > 0 || task.category) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.category && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.category.color }}
                />
                {task.category.name}
              </span>
            )}
            {task.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="px-1.5 py-0 text-[10px] font-normal h-4"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Due date */}
      {dueInfo && (
        <span
          className={cn(
            'flex items-center gap-1 text-xs whitespace-nowrap shrink-0',
            dueInfo.overdue && !isCompleted ? 'text-red-500' : 'text-muted-foreground'
          )}
        >
          <CalendarDays className="h-3 w-3" />
          {dueInfo.label}
        </span>
      )}

      {/* Duration */}
      {showDuration && task.startedAt && task.completedAt && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          耗时 {formatDuration(task.startedAt, task.completedAt)}
        </span>
      )}

      {/* More menu */}
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4 mr-2" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const text = task.description
                ? `${task.title}\n${task.description}`
                : task.title
              navigator.clipboard.writeText(text)
            }}>
              <Copy className="h-4 w-4 mr-2" />
              复制
            </DropdownMenuItem>
            {llmEnabled && onDecompose && (
              <DropdownMenuItem onClick={() => onDecompose(task)}>
                <GitBranch className="h-4 w-4 mr-2" />
                AI 拆解子任务
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirmBeforeDelete) {
                  setDeleteConfirmOpen(true)
                } else {
                  deleteTask(task.id)
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务「{task.title}」吗？该操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTask(task.id)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
