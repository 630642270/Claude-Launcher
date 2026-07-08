import type { BrowserWindow } from 'electron'
import type { IPty } from 'node-pty'
import * as pty from 'node-pty'
import type { AppConfig } from '../../shared/types'
import { emitSessionStateChange } from './sessionEvents'
import { buildEmbeddedEnv, buildEmbeddedSpawn } from './embeddedShell'

let activePty: IPty | null = null
let activeWindow: BrowserWindow | null = null
let embeddedAvailable: boolean | null = null
let currentSessionId = 0
let sessionActive = false

function invalidateSession(): number {
  currentSessionId += 1
  return currentSessionId
}

function notifySessionState(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return
  window.webContents.send('terminal:session', { active: sessionActive })
  emitSessionStateChange()
}

export function isEmbeddedSessionActive(): boolean {
  return sessionActive
}

export function isEmbeddedTerminalAvailable(): boolean {
  if (embeddedAvailable !== null) return embeddedAvailable

  try {
    const test = pty.spawn(process.env.ComSpec ?? 'cmd.exe', ['/c', 'echo ok'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      useConpty: true
    })
    test.kill()
    embeddedAvailable = true
  } catch {
    embeddedAvailable = false
  }

  return embeddedAvailable
}

export function getActivePty(): IPty | null {
  return activePty
}

export function killEmbeddedTerminal(): void {
  invalidateSession()
  sessionActive = false
  const window = activeWindow
  if (activePty) {
    activePty.kill()
    activePty = null
  }
  activeWindow = null
  notifySessionState(window)
}

export async function launchEmbeddedTerminal(
  window: BrowserWindow,
  config: AppConfig,
  projectPath: string,
  claudePath: string,
  size?: { cols: number; rows: number }
): Promise<void> {
  killEmbeddedTerminal()

  const env = buildEmbeddedEnv(config)
  const { file, args } = buildEmbeddedSpawn(config, claudePath, projectPath)
  const cols = size?.cols ?? 100
  const rows = size?.rows ?? 28
  const sessionId = currentSessionId

  try {
    activeWindow = window
    activePty = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: projectPath,
      env,
      useConpty: true
    })
    sessionActive = true
    embeddedAvailable = true
    notifySessionState(window)
  } catch (error) {
    embeddedAvailable = false
    sessionActive = false
    throw error
  }

  activePty.onData((data) => {
    if (sessionId !== currentSessionId) return
    if (!activeWindow || activeWindow.isDestroyed()) return
    activeWindow.webContents.send('terminal:data', data)
  })

  activePty.onExit(() => {
    if (sessionId !== currentSessionId) return
    activePty = null
    sessionActive = false
    if (activeWindow && !activeWindow.isDestroyed()) {
      activeWindow.webContents.send('terminal:exit')
      notifySessionState(activeWindow)
    }
  })
}

export function writeToTerminal(data: string): void {
  activePty?.write(data)
}

export function resizeTerminal(cols: number, rows: number): void {
  if (!activePty || cols <= 0 || rows <= 0) return
  activePty.resize(cols, rows)
}
