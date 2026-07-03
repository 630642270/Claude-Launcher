import { buildClaudeEnv } from '../src/main/envBuilder'
import { DEFAULT_CONFIG } from '../src/shared/types'

process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
process.env.ANTHROPIC_API_KEY = 'system-key-should-be-overridden'

const testConfig = {
  ...DEFAULT_CONFIG,
  providerId: 'custom' as const,
  baseUrl: 'https://api.example.com/anthropic',
  apiKey: 'sk-test-provider-key',
  models: {
    ...DEFAULT_CONFIG.models,
    main: 'custom-model-pro',
    opus: 'custom-model-opus',
    sonnet: 'custom-model-sonnet',
    haiku: 'custom-model-haiku',
    subagent: 'custom-model-flash'
  }
}

const env = buildClaudeEnv(testConfig)

const userEnvBefore = process.env.ANTHROPIC_BASE_URL
const childEnv = env.ANTHROPIC_BASE_URL
const childToken = env.ANTHROPIC_AUTH_TOKEN
const systemKeyStripped = env.ANTHROPIC_API_KEY

const passed = [
  userEnvBefore === 'https://api.anthropic.com',
  childEnv === 'https://api.example.com/anthropic',
  childToken === 'sk-test-provider-key',
  systemKeyStripped === undefined,
  env.ANTHROPIC_MODEL === 'custom-model-pro'
].every(Boolean)

if (!passed) {
  console.error('Env isolation verification failed.')
  process.exit(1)
}

console.log('Env isolation verification passed.')
