import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { SidebarCollapsed } from './SidebarCollapsed'
import { SidebarPanel } from './SidebarPanel'
import { useThemeStore } from '@/stores'

type DockEdge = 'top' | 'left' | 'right'

const COLLAPSE_DELAY = 400
const EXPAND_THRESHOLD = 20

function getEdgeFromURL(): DockEdge {
  const params = new URLSearchParams(window.location.search)
  return (params.get('edge') as DockEdge) || 'right'
}

export function SidebarMode() {
  const loadTheme = useThemeStore((s) => s.loadTheme)
  const edge = useMemo(getEdgeFromURL, [])
  const [expanded, setExpanded] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  // Detect size change to sync with main process resize
  useEffect(() => {
    const handleResize = () => {
      const isLarge = edge === 'top'
        ? window.innerHeight > EXPAND_THRESHOLD
        : window.innerWidth > EXPAND_THRESHOLD
      setExpanded(isLarge)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [edge])

  const containerRef = useRef<HTMLDivElement>(null)
  const mouseInsideRef = useRef(false)

  const scheduleCollapse = useCallback(() => {
    if (collapseTimer.current) return
    collapseTimer.current = setTimeout(() => {
      window.api.sidebarCollapse()
      collapseTimer.current = null
    }, COLLAPSE_DELAY)
  }, [])

  const handleMouseEnter = useCallback(() => {
    mouseInsideRef.current = true
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current)
      collapseTimer.current = null
    }
    window.api.sidebarExpand()
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseInsideRef.current = false
    // 输入框聚焦时不收缩，避免打字时侧边栏消失
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      return
    }
    scheduleCollapse()
  }, [scheduleCollapse])

  // 输入框失焦后，如果鼠标不在面板内则触发收缩
  useEffect(() => {
    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (!mouseInsideRef.current) {
          scheduleCollapse()
        }
      }
    }
    document.addEventListener('focusout', handleFocusOut)
    return () => document.removeEventListener('focusout', handleFocusOut)
  }, [scheduleCollapse])

  useEffect(() => {
    return () => {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {expanded ? <SidebarPanel /> : <SidebarCollapsed edge={edge} />}
    </div>
  )
}
