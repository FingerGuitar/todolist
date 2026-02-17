import { app, BrowserWindow, shell, nativeImage, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { initDatabase, closeDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { registerLlmIpcHandlers } from './llm'
import { loadSettings } from './settings'
import { createTray, destroyTray, refreshTrayMenu } from './tray'
import { startReminderScheduler, stopReminderScheduler } from './reminder'
import {
  registerDockIpc,
  setupEdgeDetection,
  destroyDockWindow,
  toggleDockMode,
  isDockActive
} from './dock'

let mainWindow: BrowserWindow | null = null

// ---- Window state persistence ----

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  const defaults: WindowState = { width: 1280, height: 800, isMaximized: false }
  const statePath = getWindowStatePath()
  if (!existsSync(statePath)) return defaults
  try {
    return { ...defaults, ...JSON.parse(readFileSync(statePath, 'utf-8')) }
  } catch {
    return defaults
  }
}

function saveWindowState(win: BrowserWindow): void {
  const bounds = win.getBounds()
  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: win.isMaximized()
  }
  try {
    writeFileSync(getWindowStatePath(), JSON.stringify(state))
  } catch {
    // Ignore write errors
  }
}

// ---- Window creation ----

function createWindow(): void {
  const state = loadWindowState()

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../resources/icon.ico')

  mainWindow = new BrowserWindow({
    icon: nativeImage.createFromPath(iconPath),
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  if (state.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Save window state on resize/move
  mainWindow.on('resize', () => saveWindowState(mainWindow!))
  mainWindow.on('move', () => saveWindowState(mainWindow!))
  mainWindow.on('maximize', () => saveWindowState(mainWindow!))
  mainWindow.on('unmaximize', () => saveWindowState(mainWindow!))

  // Close behavior: minimize to tray or quit based on settings
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      const settings = loadSettings()
      if (settings.closeToTray) {
        e.preventDefault()
        mainWindow!.hide()
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---- App lifecycle ----

// Custom property to track quit intent
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}
app.isQuitting = false

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  registerLlmIpcHandlers()

  // 同步开机自启动状态
  const settings = loadSettings()
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch })

  createWindow()

  if (mainWindow) {
    registerDockIpc(mainWindow)
    setupEdgeDetection(mainWindow)
    createTray(
      mainWindow,
      () => toggleDockMode(mainWindow),
      isDockActive
    )
  }

  startReminderScheduler()

  // Ctrl+Shift+D: toggle dock mode
  globalShortcut.register('Ctrl+Shift+D', () => {
    toggleDockMode(mainWindow)
    refreshTrayMenu()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  destroyDockWindow()
  stopReminderScheduler()
  destroyTray()
  closeDatabase()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
