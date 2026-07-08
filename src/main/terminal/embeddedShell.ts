import { existsSync } from 'fs'
import type { AppConfig } from '../../shared/types'
import { buildClaudeEnv } from '../envBuilder'
import { appendCliArgsToCommand, buildClaudeCliArgs } from './claudeCliArgs'

export function buildEmbeddedEnv(config: AppConfig): Record<string, string> {
  const env = buildClaudeEnv(config) as Record<string, string>

  if (process.platform === 'win32') {
    env.PYTHONIOENCODING = 'utf-8'
    env.PYTHONUTF8 = '1'
    env.LANG = 'zh_CN.UTF-8'
    env.LC_ALL = 'zh_CN.UTF-8'
    env.COLORTERM = 'truecolor'
    env.TERM = 'xterm-256color'
  }

  return env
}

export function buildEmbeddedSpawn(
  config: AppConfig,
  claudePath: string,
  _projectPath: string
): { file: string; args: string[] } {
  const cliArgs = buildClaudeCliArgs(config)

  if (process.platform === 'win32') {
    if (existsSync(claudePath)) {
      return { file: claudePath, args: cliArgs }
    }

    const command = claudePath.includes(' ') ? `"${claudePath}"` : claudePath
    return {
      file: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `chcp 65001>nul && ${appendCliArgsToCommand(command, cliArgs)}`]
    }
  }

  return {
    file: process.env.SHELL ?? '/bin/bash',
    args: ['-lc', appendCliArgsToCommand(claudePath, cliArgs)]
  }
}
