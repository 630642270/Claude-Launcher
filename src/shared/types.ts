export type TerminalMode = 'embedded' | 'external' | 'ask'

export type ExternalTerminalPreference = 'wt' | 'powershell' | 'cmd'

export { TERMINAL_MODE_LABELS, formatTerminalMode } from './labels'

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

export interface EnvPair {
  key: string
  value: string
}

export interface AvailableModel {
  id: string
  displayName?: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  models: AvailableModel[]
}

export interface BenchmarkResult {
  ok: boolean
  message: string
  tokensPerSecond?: number
  ttftSeconds?: number
  outputTokens?: number
}

export interface ProviderRequest {
  baseUrl?: string
  apiKey?: string
  modelsUrl?: string
  profileId?: string
  model?: string
}

export interface ApiProfile {
  id: string
  name: string
  baseUrl: string
  /** Optional models list endpoint; empty = {baseUrl}/v1/models */
  modelsUrl: string
  models: ModelConfig
  availableModels: AvailableModel[]
  modelsFetchedAt?: number
  lastLaunchModel?: string
  createdAt: number
  updatedAt: number
}

export interface ProfileView extends ApiProfile {
  apiKeyMasked: string
}

export interface ProfileInput {
  id?: string
  name: string
  baseUrl: string
  modelsUrl?: string
  apiKey?: string
  models: ModelConfig
  availableModels?: AvailableModel[]
  modelsFetchedAt?: number
}

export interface AppConfig {
  activeProfileId: string
  apiKey: string
  baseUrl: string
  modelsUrl: string
  models: ModelConfig
  availableModels: AvailableModel[]
  modelsFetchedAt?: number
  customEnv: EnvPair[]
  terminalMode: TerminalMode
  externalTerminal: ExternalTerminalPreference
  claudePath: string
  lastProjectPath: string
  minimizeToTray: boolean
  disableNonessentialTraffic: boolean
  dangerouslySkipPermissions: boolean
  terminalFontSize: number
  terminalScrollback: number
}

export type GlobalSettings = Pick<
  AppConfig,
  | 'customEnv'
  | 'terminalMode'
  | 'externalTerminal'
  | 'claudePath'
  | 'lastProjectPath'
  | 'minimizeToTray'
  | 'disableNonessentialTraffic'
  | 'dangerouslySkipPermissions'
  | 'terminalFontSize'
  | 'terminalScrollback'
>

export interface ProfileSaveRequest {
  profile: ProfileInput
  global?: Partial<GlobalSettings>
}

export interface LaunchRecord {
  id: string
  projectPath: string
  terminalMode: 'embedded' | 'external'
  timestamp: number
  model: string
  profileName?: string
}

export interface LaunchOptions {
  projectPath: string
  mode?: 'embedded' | 'external'
  model?: string
  terminalSize?: { cols: number; rows: number }
}

export interface ClaudeDetectionResult {
  found: boolean
  path?: string
}

export type ConfigView = Omit<AppConfig, 'apiKey'> & {
  apiKeyMasked: string
  profiles: ProfileView[]
}

export const DEFAULT_CONFIG: AppConfig = {
  activeProfileId: '',
  apiKey: '',
  baseUrl: '',
  modelsUrl: '',
  models: { ...EMPTY_MODELS },
  availableModels: [],
  customEnv: [],
  terminalMode: 'embedded',
  externalTerminal: 'wt',
  claudePath: '',
  lastProjectPath: '',
  minimizeToTray: true,
  disableNonessentialTraffic: true,
  dangerouslySkipPermissions: false,
  terminalFontSize: 14,
  terminalScrollback: 2000
}

export const EFFORT_OPTIONS = ['max', 'high', 'medium', 'low']