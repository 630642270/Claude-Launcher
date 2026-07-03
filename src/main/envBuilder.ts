import type { AppConfig } from '../shared/types'

const ANTHROPIC_PREFIXES = ['ANTHROPIC_', 'CLAUDE_CODE_']

function stripManagedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...env }

  for (const key of Object.keys(cleaned)) {
    if (ANTHROPIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete cleaned[key]
    }
  }

  delete cleaned.ANTHROPIC_API_KEY
  delete cleaned.DEEPSEEK_API_KEY

  return cleaned
}

export function buildClaudeEnv(config: AppConfig): NodeJS.ProcessEnv {
  const env = stripManagedEnv(process.env)

  Object.assign(env, {
    ANTHROPIC_BASE_URL: config.baseUrl,
    ANTHROPIC_AUTH_TOKEN: config.apiKey,
    ANTHROPIC_MODEL: config.models.main,
    ANTHROPIC_DEFAULT_OPUS_MODEL: config.models.opus,
    ANTHROPIC_DEFAULT_SONNET_MODEL: config.models.sonnet,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: config.models.haiku,
    CLAUDE_CODE_SUBAGENT_MODEL: config.models.subagent,
    CLAUDE_CODE_EFFORT_LEVEL: config.models.effortLevel,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: config.disableNonessentialTraffic ? '1' : '0'
  })

  for (const pair of config.customEnv) {
    const key = pair.key.trim()
    if (!key) continue
    env[key] = pair.value
  }

  return env
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}
