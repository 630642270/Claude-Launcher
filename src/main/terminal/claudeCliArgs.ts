import type { AppConfig } from '../../shared/types'

export function buildClaudeCliArgs(config: AppConfig): string[] {
  return config.dangerouslySkipPermissions ? ['--dangerously-skip-permissions'] : []
}

export function appendCliArgsToCommand(claudePath: string, args: string[]): string {
  if (args.length === 0) return claudePath
  return `${claudePath} ${args.join(' ')}`
}
