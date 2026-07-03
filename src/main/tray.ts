import { BrowserWindow, Menu, Tray, nativeImage, app } from 'electron'
import { join } from 'path'
import { quickLaunchFromTray } from './ipc/handlers'
import { isEmbeddedSessionActive, killEmbeddedTerminal } from './terminal/embedded'
import { onSessionStateChange } from './terminal/sessionEvents'

let tray: Tray | null = null
let getMainWindowRef: (() => BrowserWindow | null) | null = null
let unsubscribeSessionState: (() => void) | null = null

export function setTrayQuitting(_value: boolean): void {
  // kept for lifecycle hook symmetry
}

function buildTrayIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
}

function buildTrayMenu(): Menu {
  const sessionActive = isEmbeddedSessionActive()

  return Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        const win = getMainWindowRef?.()
        if (win) {
          win.show()
          win.focus()
        }
      }
    },
    {
      label: '快速启动 Claude Code',
      click: async () => {
        try {
          await quickLaunchFromTray()
          const win = getMainWindowRef?.()
          win?.show()
          win?.focus()
        } catch (error) {
          const win = getMainWindowRef?.()
          if (win) {
            win.show()
            win.focus()
            win.webContents.send('app:error', String(error))
          }
        }
      }
    },
    ...(sessionActive
      ? [
          {
            label: '终止内嵌会话',
            click: () => {
              killEmbeddedTerminal()
            }
          } as const
        ]
      : []),
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        tray?.destroy()
        tray = null
        app.quit()
      }
    }
  ])
}

export function refreshTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu())
  tray.setToolTip(
    isEmbeddedSessionActive() ? 'Claude Launcher · 内嵌会话运行中' : 'Claude Launcher'
  )
}

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  getMainWindowRef = getMainWindow
  tray = new Tray(buildTrayIcon())
  refreshTrayMenu()
  unsubscribeSessionState = onSessionStateChange(refreshTrayMenu)

  tray.on('double-click', () => {
    const win = getMainWindow()
    if (win) {
      win.show()
      win.focus()
    }
  })

  return tray
}

export function destroyTray(): void {
  unsubscribeSessionState?.()
  unsubscribeSessionState = null
  tray?.destroy()
  tray = null
  getMainWindowRef = null
}
