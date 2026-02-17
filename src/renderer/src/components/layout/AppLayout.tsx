import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'

interface AppLayoutProps {
  children: ReactNode
  onNewTask?: (categoryId?: number) => void
  onAddCategory?: (parentId?: number) => void
  onEditCategory?: (categoryId: number) => void
  onAddTag?: () => void
  onOpenSettings?: () => void
  onAiCreate?: () => void
  onOpenReport?: () => void
}

export function AppLayout({ children, onNewTask, onAddCategory, onEditCategory, onAddTag, onOpenSettings, onAiCreate, onOpenReport }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar onAddCategory={onAddCategory} onEditCategory={onEditCategory} onAddTag={onAddTag} onNewTask={onNewTask} onOpenSettings={onOpenSettings} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header onNewTask={() => onNewTask?.()} onAiCreate={onAiCreate} onOpenReport={onOpenReport} />
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
        <StatusBar />
      </main>
    </div>
  )
}
