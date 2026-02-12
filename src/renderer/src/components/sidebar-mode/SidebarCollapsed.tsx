import { cn } from '@/lib/utils'

export function SidebarCollapsed() {
  return (
    <div
      className={cn(
        'w-[6px] h-full',
        'bg-indigo-500/40 hover:bg-indigo-500/70',
        'transition-colors duration-200 cursor-pointer'
      )}
    />
  )
}
