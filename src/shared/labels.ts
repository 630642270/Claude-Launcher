import type { TerminalMode } from './types'

export const TERMINAL_MODE_LABELS: Record<TerminalMode, string> = {
  embedded: '内嵌终端',
  external: '外部终端',
  ask: '每次启动询问'
}

export function formatTerminalMode(mode: TerminalMode | undefined): string {
  if (!mode) return TERMINAL_MODE_LABELS.embedded
  return TERMINAL_MODE_LABELS[mode] ?? mode
}
