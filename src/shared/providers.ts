export type ProviderId = 'deepseek' | 'longcat' | 'anthropic' | 'custom'

export interface ProviderPreset {
  id: ProviderId
  name: string
  baseUrl: string
  defaultModels?: Partial<ModelConfig>
}

export interface ModelConfig {
  main: string
  opus: string
  sonnet: string
  haiku: string
  subagent: string
  effortLevel: string
}

export const EMPTY_MODELS: ModelConfig = {
  main: '',
  opus: '',
  sonnet: '',
  haiku: '',
  subagent: '',
  effortLevel: 'max'
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    defaultModels: {
      main: 'deepseek-v4-pro[1m]',
      opus: 'deepseek-v4-pro[1m]',
      sonnet: 'deepseek-v4-pro[1m]',
      haiku: 'deepseek-v4-flash',
      subagent: 'deepseek-v4-flash'
    }
  },
  {
    id: 'longcat',
    name: 'LongCat',
    baseUrl: 'https://api.longcat.chat/anthropic',
    defaultModels: {
      main: 'LongCat-2.0',
      opus: 'LongCat-2.0',
      sonnet: 'LongCat-2.0',
      haiku: 'LongCat-2.0',
      subagent: 'LongCat-2.0'
    }
  },
  {
    id: 'anthropic',
    name: 'Anthropic 官方',
    baseUrl: 'https://api.anthropic.com',
    defaultModels: {
      main: 'claude-sonnet-4-20250514',
      opus: 'claude-opus-4-20250514',
      sonnet: 'claude-sonnet-4-20250514',
      haiku: 'claude-haiku-4-20250514',
      subagent: 'claude-haiku-4-20250514'
    }
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: ''
  }
]

export function getProviderPreset(id: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]
}

/** Claude Code 需要 Anthropic 格式端点；LongCat 的 /openai 仅用于拉模型列表 */
export function normalizeProviderBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (/api\.longcat\.chat\/openai$/i.test(trimmed)) {
    return 'https://api.longcat.chat/anthropic'
  }
  return trimmed
}

export function inferProviderId(baseUrl: string): ProviderId {
  const normalized = baseUrl.trim().toLowerCase()
  if (normalized.includes('deepseek.com')) return 'deepseek'
  if (normalized.includes('longcat.chat')) return 'longcat'
  if (normalized.includes('anthropic.com')) return 'anthropic'
  return 'custom'
}
