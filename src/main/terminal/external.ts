import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../../shared/types'
import { buildClaudeEnv } from '../envBuilder'
import { appendCliArgsToCommand, buildClaudeCliArgs } from './claudeCliArgs'

function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') clean[key] = value
  }
  return clean
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

function buildPowerShellClaudeCommand(claudePath: string, cliArgs: string[]): string {
  if (/^[a-zA-Z]:\\/.test(claudePath) || claudePath.includes('\\') || claudePath.includes('/')) {
    return appendCliArgsToCommand(`& '${escapePowerShellSingleQuoted(claudePath)}'`, cliArgs)
  }
  return appendCliArgsToCommand(claudePath, cliArgs)
}

function buildCmdClaudeArg(claudePath: string, cliArgs: string[]): string {
  const quoted = claudePath.includes(' ') ? `"${claudePath}"` : claudePath
  return appendCliArgsToCommand(quoted, cliArgs)
}

function resolveWindowsTerminal(): string {
  const localWt = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps', 'wt.exe')
  if (existsSync(localWt)) return localWt
  return 'wt.exe'
}

/** 从 GUI 进程（Electron）拉起可见控制台窗口 */
function spawnWindowsConsole(
  executable: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; cwd: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const comspec = process.env.ComSpec ?? 'cmd.exe'
    const cmdArgs = ['/d', '/s', '/c', 'start', '', executable, ...args]

    const child = spawn(comspec, cmdArgs, {
      env: sanitizeEnv(options.env),
      cwd: options.cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function launchUnixExternal(
  env: NodeJS.ProcessEnv,
  projectPath: string,
  claudePath: string,
  cliArgs: string[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const shell = process.env.SHELL ?? '/bin/bash'
    const child = spawn(shell, ['-lc', appendCliArgsToCommand(claudePath, cliArgs)], {
      env: sanitizeEnv(env),
      detached: true,
      stdio: 'ignore',
      cwd: projectPath
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

export function launchExternalTerminal(
  config: AppConfig,
  projectPath: string,
  claudePath: string
): Promise<void> {
  const env = buildClaudeEnv(config)
  const preference = config.externalTerminal
  const cliArgs = buildClaudeCliArgs(config)

  if (process.platform !== 'win32') {
    return launchUnixExternal(env, projectPath, claudePath, cliArgs)
  }

  const psCommand = buildPowerShellClaudeCommand(claudePath, cliArgs)
  const cmdArg = buildCmdClaudeArg(claudePath, cliArgs)

  if (preference === 'wt') {
    const wt = resolveWindowsTerminal()
    return spawnWindowsConsole(
      wt,
      ['-d', projectPath, 'powershell.exe', '-NoExit', '-NoLogo', '-Command', psCommand],
      { env, cwd: projectPath }
    )
  }

  if (preference === 'powershell') {
    return spawnWindowsConsole(
      'powershell.exe',
      ['-NoExit', '-NoLogo', '-Command', psCommand],
      { env, cwd: projectPath }
    )
  }

  return spawnWindowsConsole('cmd.exe', ['/k', cmdArg], { env, cwd: projectPath })
}

export async function detectClaude(customPath?: string): Promise<{ found: boolean; path?: string }> {
  if (customPath) {
    if (existsSync(customPath)) {
      return { found: true, path: customPath }
    }
    return { found: false, path: customPath }
  }

  return new Promise((resolve) => {
    const checker = spawn('where', ['claude'], {
      shell: true,
      windowsHide: true
    })

    let output = ''
    checker.stdout.on('data', (data: Buffer) => {
      output += data.toString()
    })

    checker.on('close', (code) => {
      if (code !== 0) {
        resolve({ found: false })
        return
      }

      const firstLine = output.split(/\r?\n/).find((line) => line.trim())
      resolve({ found: Boolean(firstLine), path: firstLine?.trim() })
    })

    checker.on('error', () => resolve({ found: false }))
  })
}

export async function resolveClaudePath(config: AppConfig): Promise<string> {
  if (config.claudePath) return config.claudePath

  const detected = await detectClaude()
  if (detected.path) return detected.path

  return 'claude'
}
