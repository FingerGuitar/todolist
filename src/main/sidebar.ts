import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS } from '../shared/types'

let sidebarWindow: BrowserWindow | null = null
let isExpanded = false

const COLLAPSED_WIDTH = 6
const EXPANDED_WIDTH = 360

function getWorkArea() {
  return screen.getPrimaryDisplay().workArea
}

function getCollapsedBounds() {
  const wa = getWorkArea()
  return {
    x: wa.x + wa.width - COLLAPSED_WIDTH,
    y: wa.y,
    width: COLLAPSED_WIDTH,
    height: wa.height
  }
}

function getExpandedBounds() {
  const wa = getWorkArea()
  return {
    x: wa.x + wa.width - EXPANDED_WIDTH,
    y: wa.y,
    width: EXPANDED_WIDTH,
    height: wa.height
  }
}

export function createSidebarWindow(): BrowserWindow {
  const bounds = getCollapsedBounds()

  sidebarWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // Load sidebar page: dev uses loadURL, production uses loadFile (avoids Windows backslash issue)
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    sidebarWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=sidebar`)
  } else {
    sidebarWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode: 'sidebar' }
    })
  }

  sidebarWindow.once('ready-to-show', () => {
    sidebarWindow?.show()
  })

  sidebarWindow.on('closed', () => {
    sidebarWindow = null
    isExpanded = false
  })

  return sidebarWindow
}

export function expandSidebar(): void {
  if (!sidebarWindow || isExpanded) return
  isExpanded = true
  sidebarWindow.setBounds(getExpandedBounds())
}

export function collapseSidebar(): void {
  if (!sidebarWindow || !isExpanded) return
  isExpanded = false
  sidebarWindow.setBounds(getCollapsedBounds())
}

export function destroySidebarWindow(): void {
  if (sidebarWindow) {
    sidebarWindow.destroy()
    sidebarWindow = null
    isExpanded = false
  }
}

export function isSidebarActive(): boolean {
  return sidebarWindow !== null && !sidebarWindow.isDestroyed()
}

export function toggleSidebarMode(mainWindow: BrowserWindow | null): void {
  if (isSidebarActive()) {
    // Exit sidebar mode → show main window
    destroySidebarWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  } else {
    // Enter sidebar mode → hide main window, show sidebar
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide()
    }
    createSidebarWindow()
  }
}

export function registerSidebarIpc(mainWindow: BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.SIDEBAR_EXPAND, () => {
    expandSidebar()
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_COLLAPSE, () => {
    collapseSidebar()
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_TOGGLE, () => {
    toggleSidebarMode(mainWindow)
  })

  ipcMain.handle(IPC_CHANNELS.SIDEBAR_SHOW_MAIN, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      destroySidebarWindow()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
