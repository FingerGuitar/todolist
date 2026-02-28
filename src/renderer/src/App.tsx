import { useEffect, useState, useCallback } from 'react'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout'
import { TaskList, TaskForm, AiCreateDialog, TaskDecomposeDialog } from '@/components/task'
import { CategoryForm } from '@/components/category'
import { TagForm } from '@/components/tag'
import { SidebarMode } from '@/components/sidebar-mode'
import { useThemeStore, useSettingsStore, useCategoryStore } from '@/stores'
import { useDataSync } from '@/hooks/useDataSync'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import { ReportDialog } from '@/components/report/ReportDialog'
import type { TaskWithRelations, Category } from '@shared/types'

const isSidebarMode = new URLSearchParams(window.location.search).get('mode') === 'sidebar'

function App() {
  if (isSidebarMode) {
    return <SidebarMode />
  }

  return <MainApp />
}

function MainApp() {
  const loadTheme = useThemeStore((s) => s.loadTheme)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  useDataSync()

  // Dialog states
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [defaultTaskCategoryId, setDefaultTaskCategoryId] = useState<number | undefined>(undefined)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [parentCategoryId, setParentCategoryId] = useState<number | undefined>(undefined)
  const [tagFormOpen, setTagFormOpen] = useState(false)
  const [aiCreateOpen, setAiCreateOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [decomposeTask, setDecomposeTask] = useState<TaskWithRelations | null>(null)

  useEffect(() => {
    loadTheme()
    loadSettings()
  }, [loadTheme, loadSettings])

  const handleNewTask = useCallback((categoryId?: number) => {
    setEditingTask(null)
    setDefaultTaskCategoryId(categoryId)
    setTaskFormOpen(true)
  }, [])

  const handleEditTask = useCallback((task: TaskWithRelations) => {
    setEditingTask(task)
    setTaskFormOpen(true)
  }, [])

  // Keyboard shortcut: Ctrl+N for new task
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleNewTask()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNewTask])

  return (
    <AppLayout
      onNewTask={(categoryId?: number) => handleNewTask(categoryId)}
      onOpenSettings={() => setSettingsOpen(true)}
      onAddCategory={(parentId?: number) => {
        setEditingCategory(null)
        setParentCategoryId(parentId)
        setCategoryFormOpen(true)
      }}
      onEditCategory={(categoryId: number) => {
        const cat = useCategoryStore.getState().categories.find((c) => c.id === categoryId) ?? null
        setEditingCategory(cat)
        setParentCategoryId(undefined)
        setCategoryFormOpen(true)
      }}
      onAddTag={() => setTagFormOpen(true)}
      onAiCreate={() => setAiCreateOpen(true)}
      onOpenReport={() => setReportOpen(true)}
    >
      <TaskList onEditTask={handleEditTask} onDecomposeTask={setDecomposeTask} />

      <TaskForm
        open={taskFormOpen}
        onOpenChange={(open) => {
          setTaskFormOpen(open)
          if (!open) setDefaultTaskCategoryId(undefined)
        }}
        task={editingTask}
        defaultCategoryId={defaultTaskCategoryId}
      />

      <CategoryForm
        open={categoryFormOpen}
        onOpenChange={(open) => {
          setCategoryFormOpen(open)
          if (!open) {
            setParentCategoryId(undefined)
            setEditingCategory(null)
          }
        }}
        category={editingCategory}
        parentId={parentCategoryId}
      />

      <TagForm
        open={tagFormOpen}
        onOpenChange={setTagFormOpen}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AiCreateDialog open={aiCreateOpen} onOpenChange={setAiCreateOpen} />

      <TaskDecomposeDialog
        open={!!decomposeTask}
        onOpenChange={(open) => { if (!open) setDecomposeTask(null) }}
        task={decomposeTask}
      />

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <Toaster position="top-center" richColors duration={2000} />
    </AppLayout>
  )
}

export default App
