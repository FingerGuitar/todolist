import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout'
import { TaskList, TaskForm } from '@/components/task'
import { CategoryForm } from '@/components/category'
import { TagForm } from '@/components/tag'
import { SidebarMode } from '@/components/sidebar-mode'
import { useThemeStore } from '@/stores'
import type { TaskWithRelations } from '@shared/types'

const isSidebarMode = new URLSearchParams(window.location.search).get('mode') === 'sidebar'

function App() {
  if (isSidebarMode) {
    return <SidebarMode />
  }

  return <MainApp />
}

function MainApp() {
  const loadTheme = useThemeStore((s) => s.loadTheme)

  // Dialog states
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [tagFormOpen, setTagFormOpen] = useState(false)

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  const handleNewTask = useCallback(() => {
    setEditingTask(null)
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
      onNewTask={handleNewTask}
      onAddCategory={() => setCategoryFormOpen(true)}
      onAddTag={() => setTagFormOpen(true)}
    >
      <TaskList onEditTask={handleEditTask} />

      <TaskForm
        open={taskFormOpen}
        onOpenChange={setTaskFormOpen}
        task={editingTask}
      />

      <CategoryForm
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
      />

      <TagForm
        open={tagFormOpen}
        onOpenChange={setTagFormOpen}
      />
    </AppLayout>
  )
}

export default App
