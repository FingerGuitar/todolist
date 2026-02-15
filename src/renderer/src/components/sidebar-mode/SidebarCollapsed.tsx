import { cn } from '@/lib/utils'

interface SidebarCollapsedProps {
  edge: 'top' | 'left' | 'right'
}

export function SidebarCollapsed({ edge }: SidebarCollapsedProps) {
  const isHorizontal = edge === 'top'

  return (
    <div
      className={cn(
        'bg-indigo-500/40 hover:bg-indigo-500/70',
        'transition-colors duration-200 cursor-pointer',
        isHorizontal ? 'w-full h-[6px]' : 'w-[6px] h-full'
      )}
    />
  )
}
