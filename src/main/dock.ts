import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../shared/types'

export type DockEdge = 'top' | 'left' | 'right'

let dockWindow: BrowserWindow | null = null
let dockEdge: DockEdge | null = null
let isExpanded = false
let moveDebounceTimer: ReturnType<typeof setTimeout> | null = null
let cooldownUntil = 0

const EDGE_THRESHOLD = 2
const COLLAPSED_SIZE = 6
const EXPANDED_WIDTH = 360
const EXPANDED_HEIGHT = 520
const MOVE_DEBOUNCE = 300

function getWorkArea() {
  return screen.getPrimaryDisplay().workArea
}

function detectEdge(mainWindow: BrowserWindow): DockEdge | null {
  const bounds = mainWindow.getBounds()
  const wa = getWorkArea()
  if (bounds.y <= wa.y + EDGE_THRESHOLD) return 'top'
  if (bounds.x <= wa.x + EDGE_THRESHOLD) return 'left'
  if (bounds.x + bounds.width >= wa.x + wa.width - EDGE_THRESHOLD) return 'right'
  return null
}

function getCollapsedBounds(edge: DockEdge) {
  const wa = getWorkArea()
  const centerY = wa.y + Math.floor((wa.height - EXPANDED_HEIGHT) / 2)
  const centerX = wa.x + Math.floor((wa.width - EXPANDED_WIDTH) / 2)
  switch (edge) {
    case 'right':
      return { x: wa.x + wa.width - COLLAPSED_SIZE, y: centerY, width: COLLAPSED_SIZE, height: EXPANDED_HEIGHT }
    case 'left':
      return { x: wa.x, y: centerY, width: COLLAPSED_SIZE, height: EXPANDED_HEIGHT }
    case 'top':
      return { x: centerX, y: wa.y, width: EXPANDED_WIDTH, height: COLLAPSED_SIZE }
  }
}

function getExpandedBounds(edge: DockEdge) {
  const wa = getWorkArea()
  const centerY = wa.y + Math.floor((wa.height - EXPANDED_HEIGHT) / 2)
  const centerX = wa.x + Math.floor((wa.width - EXPANDED_WIDTH) / 2)
  switch (edge) {
    case 'right':
      return { x: wa.x + wa.width - EXPANDED_WIDTH, y: centerY, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
    case 'left':
      return { x: wa.x, y: centerY, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
    case 'top':
      return { x: centerX, y: wa.y, width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT }
  }
}

function createDockWindow(edge: DockEdge): BrowserWindow {
  const bounds = getCollapsedBounds(edge)

  dockWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  const query = { mode: 'sidebar', edge }
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    dockWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=sidebar&edge=${edge}`)
  } else {
    dockWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  dockWindow.once('ready-to-show', () => {
    dockWindow?.show()
  })

  dockWindow.on('closed', () => {
    dockWindow = null
    dockEdge = null
    isExpanded = false
  })

  return dockWindow
}

export function expandDock(): void {
  if (!dockWindow || !dockEdge || isExpanded) return
  isExpanded = true
  dockWindow.setBounds(getExpandedBounds(dockEdge))
}

export function collapseDock(): void {
  if (!dockWindow || !dockEdge || !isExpanded) return
  isExpanded = false
  dockWindow.setBounds(getCollapsedBounds(dockEdge))
}

export function destroyDockWindow(): void {
  if (dockWindow) {
    dockWindow.destroy()
    dockWindow = null
    dockEdge = null
    isExpanded = false
  }
}

export function isDockActive(): boolean {
  return dockWindow !== null && !dockWindow.isDestroyed()
}

function enterDockMode(mainWindow: BrowserWindow, edge: DockEdge): void {
  dockEdge = edge
  mainWindow.hide()
  createDockWindow(edge)
}

export function exitDockMode(mainWindow: BrowserWindow | null): void {
  destroyDockWindow()
  cooldownUntil = Date.now() + 1500
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Offset from edge so it doesn't re-trigger immediately
    const wa = getWorkArea()
    const bounds = mainWindow.getBounds()
    const offset = 50
    if (dockEdge === 'right' || bounds.x + bounds.width > wa.x + wa.width - EDGE_THRESHOLD * 2) {
      mainWindow.setBounds({ ...bounds, x: wa.x + wa.width - bounds.width - offset })
    } else if (dockEdge === 'left' || bounds.x < wa.x + EDGE_THRESHOLD * 2) {
      mainWindow.setBounds({ ...bounds, x: wa.x + offset })
    } else if (dockEdge === 'top' || bounds.y < wa.y + EDGE_THRESHOLD * 2) {
      mainWindow.setBounds({ ...bounds, y: wa.y + offset })
    }
    mainWindow.show()
    mainWindow.focus()
  }
}

export function toggleDockMode(mainWindow: BrowserWindow | null): void {
  if (isDockActive()) {
    exitDockMode(mainWindow)
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    // Manual toggle: dock to right by default
    enterDockMode(mainWindow, 'right')
  }
}

export function setupEdgeDetection(mainWindow: BrowserWindow): void {
  mainWindow.on('move', () => {
    if (isDockActive()) return
    if (Date.now() < cooldownUntil) return

    if (moveDebounceTimer) clearTimeout(moveDebounceTimer)
    moveDebounceTimer = setTimeout(() => {
      if (isDockActive()) return
      if (mainWindow.isDestroyed() || !mainWindow.isVisible()) return

      const edge = detectEdge(mainWindow)
      if (edge) {
        enterDockMode(mainWindow, edge)
      }
    }, MOVE_DEBOUNCE)
  })
}

export function registerDockIpc(mainWindow: BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.SIDEBAR_EXPAND, () => {
    expandDock()
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_COLLAPSE, () => {
    collapseDock()
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_TOGGLE, () => {
    toggleDockMode(mainWindow)
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_SHOW_MAIN, () => {
    exitDockMode(mainWindow)
  })
}
