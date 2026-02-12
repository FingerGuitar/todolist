import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let _mainWindow: BrowserWindow | null = null
let _onToggleSidebar: (() => void) | undefined
let _isSidebarActive: (() => boolean) | undefined

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'tray-icon.ico')
  }
  return join(__dirname, '../../resources/tray-icon.ico')
}

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        _mainWindow?.show()
        _mainWindow?.focus()
      }
    },
    {
      label: '侧边栏模式',
      type: 'checkbox',
      checked: _isSidebarActive?.() ?? false,
      click: () => {
        _onToggleSidebar?.()
        refreshTrayMenu()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])
}

export function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildContextMenu())
}

export function createTray(
  mainWindow: BrowserWindow,
  onToggleSidebar?: () => void,
  isSidebarActive?: () => boolean
): void {
  _mainWindow = mainWindow
  _onToggleSidebar = onToggleSidebar
  _isSidebarActive = isSidebarActive

  const icon = nativeImage.createFromPath(getTrayIconPath())

  tray = new Tray(icon)
  tray.setToolTip('TodoList')
  tray.setContextMenu(buildContextMenu())

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
