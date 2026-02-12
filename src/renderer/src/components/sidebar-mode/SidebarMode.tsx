import { useState, useEffect, useRef, useCallback } from 'react'
import { SidebarCollapsed } from './SidebarCollapsed'
import { SidebarPanel } from './SidebarPanel'
import { useThemeStore } from '@/stores'

const COLLAPSE_DELAY = 400
const EXPAND_THRESHOLD = 20

export function SidebarMode() {
  const loadTheme = useThemeStore((s) => s.loadTheme)
  const [expanded, setExpanded] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // Detect width to sync with main process resize
  useEffect(() => {
    const handleResize = () => {
      setExpanded(window.innerWidth > EXPAND_THRESHOLD)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    window.api.sidebarExpand()
  }, [])

  const handleMouseLeave = useCallback(() => {
    collapseTimer.current = setTimeout(() => {
      window.api.sidebarCollapse()
      collapseTimer.current = null
    }, COLLAPSE_DELAY)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current)
      }
    }
  }, [])

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {expanded ? <SidebarPanel /> : <SidebarCollapsed />}
    </div>
  )
}
