import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { StatusBar } from './StatusBar'

interface AppLayoutProps {
  children: ReactNode
  onNewTask?: () => void
  onAddCategory?: () => void
  onAddTag?: () => void
}

export function AppLayout({ children, onNewTask, onAddCategory, onAddTag }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar onAddCategory={onAddCategory} onAddTag={onAddTag} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header onNewTask={onNewTask} />
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
        <StatusBar />
      </main>
    </div>
  )
}
