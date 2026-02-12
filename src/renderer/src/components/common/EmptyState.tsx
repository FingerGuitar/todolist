import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-base font-medium text-muted-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground/70 max-w-[280px]">{description}</p>
      )}
    </div>
  )
}
