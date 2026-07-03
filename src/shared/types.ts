export type TerminalMode = 'embedded' | 'external' | 'ask'

export type ExternalTerminalPreference = 'wt' | 'powershell' | 'cmd'

export type { ProviderId, ProviderPreset, ModelConfig } from './providers'
export { EMPTY_MODELS, PROVIDER_PRESETS, getProviderPreset, inferProviderId } from './providers'
export { TERMINAL_MODE_LABELS, formatTerminalMode } from './labels'
import type { ProviderId, ModelConfig } from './providers'
import { EMPTY_MODELS, getProviderPreset } from './providers'

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

export interface ProviderRequest {
  baseUrl?: string
  apiKey?: string
  profileId?: string
}

export interface ApiProfile {
  id: string
  name: string
  providerId: ProviderId
  baseUrl: string
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
  providerId: ProviderId
  baseUrl: string
  apiKey?: string
  models: ModelConfig
  availableModels?: AvailableModel[]
  modelsFetchedAt?: number
}

export interface AppConfig {
  activeProfileId: string
  providerId: ProviderId
  apiKey: string
  baseUrl: string
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

const deepseekPreset = getProviderPreset('deepseek')

export const DEFAULT_CONFIG: AppConfig = {
  activeProfileId: '',
  providerId: 'deepseek',
  apiKey: '',
  baseUrl: deepseekPreset.baseUrl,
  models: { ...EMPTY_MODELS, ...deepseekPreset.defaultModels, effortLevel: 'max' },
  availableModels: [],
  customEnv: [],
  terminalMode: 'embedded',
  externalTerminal: 'wt',
  claudePath: '',
  lastProjectPath: '',
  minimizeToTray: true,
  disableNonessentialTraffic: true,
  terminalFontSize: 14,
  terminalScrollback: 2000
}

export const EFFORT_OPTIONS = ['max', 'high', 'medium', 'low']
