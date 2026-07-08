import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { safeStorage } from 'electron'
import type {
  AppConfig,
  ConfigView,
  GlobalSettings,
  LaunchRecord,
  ProfileInput,
  ProfileView,
  ProviderId
} from '../shared/types'
import { DEFAULT_CONFIG } from '../shared/types'
import { inferProviderId, normalizeProviderBaseUrl } from '../shared/providers'

interface PersistedProfile {
  id: string
  name: string
  providerId: ProviderId
  baseUrl: string
  encryptedApiKey?: string
  models: AppConfig['models']
  availableModels?: AppConfig['availableModels']
  modelsFetchedAt?: number
  lastLaunchModel?: string
  createdAt: number
  updatedAt: number
}

interface PersistedConfig {
  activeProfileId?: string
  profiles?: PersistedProfile[]
  encryptedApiKey?: string
  providerId?: ProviderId
  baseUrl?: string
  models?: AppConfig['models']
  availableModels?: AppConfig['availableModels']
  modelsFetchedAt?: number
  customEnv: AppConfig['customEnv']
  terminalMode: AppConfig['terminalMode']
  externalTerminal: AppConfig['externalTerminal']
  claudePath: string
  lastProjectPath: string
  minimizeToTray: boolean
  disableNonessentialTraffic: boolean
  dangerouslySkipPermissions: boolean
  terminalFontSize: number
  terminalScrollback: number
  history: LaunchRecord[]
}

const store = new Store<PersistedConfig>({
  name: 'claude-launcher-config',
  defaults: {
    customEnv: DEFAULT_CONFIG.customEnv,
    terminalMode: DEFAULT_CONFIG.terminalMode,
    externalTerminal: DEFAULT_CONFIG.externalTerminal,
    claudePath: DEFAULT_CONFIG.claudePath,
    lastProjectPath: DEFAULT_CONFIG.lastProjectPath,
    minimizeToTray: DEFAULT_CONFIG.minimizeToTray,
    disableNonessentialTraffic: DEFAULT_CONFIG.disableNonessentialTraffic,
    dangerouslySkipPermissions: DEFAULT_CONFIG.dangerouslySkipPermissions,
    terminalFontSize: DEFAULT_CONFIG.terminalFontSize,
    terminalScrollback: DEFAULT_CONFIG.terminalScrollback,
    history: []
  }
})

function decryptApiKey(encrypted?: string): string {
  if (!encrypted) return ''
  if (!safeStorage.isEncryptionAvailable()) return encrypted

  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return ''
  }
}

function encryptApiKey(apiKey: string): string | undefined {
  if (!apiKey) return undefined
  if (!safeStorage.isEncryptionAvailable()) return apiKey

  return safeStorage.encryptString(apiKey).toString('base64')
}

function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

function migrateProviderId(baseUrl: string, providerId?: ProviderId): ProviderId {
  const inferred = inferProviderId(baseUrl)
  if (inferred !== 'custom') return inferred
  if (providerId) return providerId
  return 'custom'
}

function createDefaultProfile(name = '默认'): PersistedProfile {
  const now = Date.now()
  const deepseekBaseUrl = DEFAULT_CONFIG.baseUrl

  return {
    id: randomUUID(),
    name,
    providerId: DEFAULT_CONFIG.providerId,
    baseUrl: deepseekBaseUrl,
    models: DEFAULT_CONFIG.models,
    availableModels: [],
    createdAt: now,
    updatedAt: now
  }
}

function ensureProfiles(data: PersistedConfig): {
  profiles: PersistedProfile[]
  activeProfileId: string
  migrated: boolean
} {
  if (data.profiles && data.profiles.length > 0) {
    const activeProfileId =
      data.activeProfileId && data.profiles.some((p) => p.id === data.activeProfileId)
        ? data.activeProfileId
        : data.profiles[0].id

    return {
      profiles: data.profiles.map((profile) => ({
        ...profile,
        baseUrl: normalizeProviderBaseUrl(profile.baseUrl),
        providerId: migrateProviderId(profile.baseUrl, profile.providerId)
      })),
      activeProfileId,
      migrated: activeProfileId !== data.activeProfileId
    }
  }

  const now = Date.now()
  const legacyBaseUrl = normalizeProviderBaseUrl(data.baseUrl ?? DEFAULT_CONFIG.baseUrl)
  const profile: PersistedProfile = {
    id: randomUUID(),
    name: '默认',
    providerId: migrateProviderId(legacyBaseUrl, data.providerId),
    baseUrl: legacyBaseUrl,
    encryptedApiKey: data.encryptedApiKey,
    models: data.models ?? DEFAULT_CONFIG.models,
    availableModels: data.availableModels ?? [],
    modelsFetchedAt: data.modelsFetchedAt,
    createdAt: now,
    updatedAt: now
  }

  return {
    profiles: [profile],
    activeProfileId: profile.id,
    migrated: true
  }
}

function persistProfilesState(
  profiles: PersistedProfile[],
  activeProfileId: string,
  data: PersistedConfig
): void {
  store.set({
    profiles,
    activeProfileId,
    customEnv: data.customEnv,
    terminalMode: data.terminalMode,
    externalTerminal: data.externalTerminal,
    claudePath: data.claudePath,
    lastProjectPath: data.lastProjectPath,
    minimizeToTray: data.minimizeToTray,
    disableNonessentialTraffic: data.disableNonessentialTraffic,
    dangerouslySkipPermissions:
      data.dangerouslySkipPermissions ?? DEFAULT_CONFIG.dangerouslySkipPermissions,
    terminalFontSize: data.terminalFontSize ?? DEFAULT_CONFIG.terminalFontSize,
    terminalScrollback: data.terminalScrollback ?? DEFAULT_CONFIG.terminalScrollback,
    history: data.history ?? []
  })
}

function loadPersistedState(): {
  data: PersistedConfig
  profiles: PersistedProfile[]
  activeProfileId: string
} {
  const data = store.store
  const { profiles, activeProfileId, migrated } = ensureProfiles(data)

  if (migrated || !data.profiles?.length) {
    persistProfilesState(profiles, activeProfileId, data)
  }

  return {
    data: store.store,
    profiles,
    activeProfileId
  }
}

function getActiveProfile(
  profiles: PersistedProfile[],
  activeProfileId: string
): PersistedProfile {
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0]
}

function profileToView(profile: PersistedProfile): ProfileView {
  return {
    id: profile.id,
    name: profile.name,
    providerId: profile.providerId,
    baseUrl: profile.baseUrl,
    models: profile.models,
    availableModels: profile.availableModels ?? [],
    modelsFetchedAt: profile.modelsFetchedAt,
    lastLaunchModel: profile.lastLaunchModel,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    apiKeyMasked: maskApiKey(decryptApiKey(profile.encryptedApiKey))
  }
}

function buildAppConfig(
  profiles: PersistedProfile[],
  activeProfileId: string,
  data: PersistedConfig
): AppConfig {
  const active = getActiveProfile(profiles, activeProfileId)

  return {
    activeProfileId: active.id,
    providerId: active.providerId,
    apiKey: decryptApiKey(active.encryptedApiKey),
    baseUrl: active.baseUrl,
    models: active.models,
    availableModels: active.availableModels ?? [],
    modelsFetchedAt: active.modelsFetchedAt,
    customEnv: data.customEnv,
    terminalMode: data.terminalMode,
    externalTerminal: data.externalTerminal,
    claudePath: data.claudePath,
    lastProjectPath: data.lastProjectPath,
    minimizeToTray: data.minimizeToTray,
    disableNonessentialTraffic: data.disableNonessentialTraffic,
    dangerouslySkipPermissions:
      data.dangerouslySkipPermissions ?? DEFAULT_CONFIG.dangerouslySkipPermissions,
    terminalFontSize: data.terminalFontSize ?? DEFAULT_CONFIG.terminalFontSize,
    terminalScrollback: data.terminalScrollback ?? DEFAULT_CONFIG.terminalScrollback
  }
}

export function getConfig(): AppConfig {
  const { data, profiles, activeProfileId } = loadPersistedState()
  return buildAppConfig(profiles, activeProfileId, data)
}

export function getActiveProfileName(): string {
  const { profiles, activeProfileId } = loadPersistedState()
  return getActiveProfile(profiles, activeProfileId).name
}

export function saveGlobalSettings(partial: Partial<GlobalSettings>): AppConfig {
  const { data, profiles, activeProfileId } = loadPersistedState()

  store.set({
    customEnv: partial.customEnv ?? data.customEnv,
    terminalMode: partial.terminalMode ?? data.terminalMode,
    externalTerminal: partial.externalTerminal ?? data.externalTerminal,
    claudePath: partial.claudePath ?? data.claudePath,
    lastProjectPath: partial.lastProjectPath ?? data.lastProjectPath,
    minimizeToTray: partial.minimizeToTray ?? data.minimizeToTray,
    disableNonessentialTraffic:
      partial.disableNonessentialTraffic ?? data.disableNonessentialTraffic,
    dangerouslySkipPermissions:
      partial.dangerouslySkipPermissions ?? data.dangerouslySkipPermissions ?? DEFAULT_CONFIG.dangerouslySkipPermissions,
    terminalFontSize: partial.terminalFontSize ?? data.terminalFontSize ?? DEFAULT_CONFIG.terminalFontSize,
    terminalScrollback:
      partial.terminalScrollback ?? data.terminalScrollback ?? DEFAULT_CONFIG.terminalScrollback,
    profiles,
    activeProfileId,
    history: data.history ?? []
  })

  return getConfig()
}

/** @deprecated Use saveGlobalSettings or saveProfile instead */
export function saveConfig(partial: Partial<AppConfig>): AppConfig {
  const global: Partial<GlobalSettings> = {}

  if (partial.customEnv !== undefined) global.customEnv = partial.customEnv
  if (partial.terminalMode !== undefined) global.terminalMode = partial.terminalMode
  if (partial.externalTerminal !== undefined) global.externalTerminal = partial.externalTerminal
  if (partial.claudePath !== undefined) global.claudePath = partial.claudePath
  if (partial.lastProjectPath !== undefined) global.lastProjectPath = partial.lastProjectPath
  if (partial.minimizeToTray !== undefined) global.minimizeToTray = partial.minimizeToTray
  if (partial.disableNonessentialTraffic !== undefined) {
    global.disableNonessentialTraffic = partial.disableNonessentialTraffic
  }
  if (partial.dangerouslySkipPermissions !== undefined) {
    global.dangerouslySkipPermissions = partial.dangerouslySkipPermissions
  }
  if (partial.terminalFontSize !== undefined) global.terminalFontSize = partial.terminalFontSize
  if (partial.terminalScrollback !== undefined) global.terminalScrollback = partial.terminalScrollback

  const hasProfileUpdate =
    partial.providerId !== undefined ||
    partial.baseUrl !== undefined ||
    partial.apiKey !== undefined ||
    partial.models !== undefined ||
    partial.availableModels !== undefined ||
    partial.modelsFetchedAt !== undefined

  if (hasProfileUpdate) {
    const current = getConfig()
    return saveProfile(
      {
        id: current.activeProfileId,
        name: getActiveProfileName(),
        providerId: partial.providerId ?? current.providerId,
        baseUrl: partial.baseUrl ?? current.baseUrl,
        apiKey: partial.apiKey,
        models: partial.models ?? current.models,
        availableModels: partial.availableModels ?? current.availableModels,
        modelsFetchedAt: partial.modelsFetchedAt ?? current.modelsFetchedAt
      },
      global
    )
  }

  if (Object.keys(global).length > 0) {
    return saveGlobalSettings(global)
  }

  return getConfig()
}

export function switchProfile(profileId: string): AppConfig {
  const { data, profiles } = loadPersistedState()

  if (!profiles.some((p) => p.id === profileId)) {
    throw new Error('配置档案不存在')
  }

  store.set({ activeProfileId: profileId, profiles, history: data.history ?? [] })
  return getConfig()
}

export function saveProfile(input: ProfileInput, global?: Partial<GlobalSettings>): AppConfig {
  const { data, profiles, activeProfileId } = loadPersistedState()
  const now = Date.now()
  const normalizedBaseUrl = normalizeProviderBaseUrl(input.baseUrl)
  const providerId = migrateProviderId(normalizedBaseUrl, input.providerId)

  let nextProfiles: PersistedProfile[]
  let nextActiveId = activeProfileId

  if (input.id && profiles.some((p) => p.id === input.id)) {
    nextProfiles = profiles.map((profile) => {
      if (profile.id !== input.id) return profile

      return {
        ...profile,
        name: input.name.trim() || profile.name,
        providerId,
        baseUrl: normalizedBaseUrl,
        encryptedApiKey: input.apiKey?.trim()
          ? encryptApiKey(input.apiKey.trim())
          : profile.encryptedApiKey,
        models: input.models,
        availableModels: input.availableModels ?? profile.availableModels ?? [],
        modelsFetchedAt: input.modelsFetchedAt ?? profile.modelsFetchedAt,
        lastLaunchModel: profile.lastLaunchModel,
        updatedAt: now
      }
    })
  } else {
    const profile: PersistedProfile = {
      id: randomUUID(),
      name: input.name.trim() || `配置 ${profiles.length + 1}`,
      providerId,
      baseUrl: normalizedBaseUrl,
      encryptedApiKey: input.apiKey?.trim() ? encryptApiKey(input.apiKey.trim()) : undefined,
      models: input.models,
      availableModels: input.availableModels ?? [],
      modelsFetchedAt: input.modelsFetchedAt,
      createdAt: now,
      updatedAt: now
    }
    nextProfiles = [...profiles, profile]
    nextActiveId = profile.id
  }

  if (global && Object.keys(global).length > 0) {
    store.set({
      profiles: nextProfiles,
      activeProfileId: nextActiveId,
      customEnv: global.customEnv ?? data.customEnv,
      terminalMode: global.terminalMode ?? data.terminalMode,
      externalTerminal: global.externalTerminal ?? data.externalTerminal,
      claudePath: global.claudePath ?? data.claudePath,
      lastProjectPath: global.lastProjectPath ?? data.lastProjectPath,
      minimizeToTray: global.minimizeToTray ?? data.minimizeToTray,
      disableNonessentialTraffic:
        global.disableNonessentialTraffic ?? data.disableNonessentialTraffic,
      dangerouslySkipPermissions:
        global.dangerouslySkipPermissions ??
        data.dangerouslySkipPermissions ??
        DEFAULT_CONFIG.dangerouslySkipPermissions,
      terminalFontSize: global.terminalFontSize ?? data.terminalFontSize ?? DEFAULT_CONFIG.terminalFontSize,
      terminalScrollback:
        global.terminalScrollback ?? data.terminalScrollback ?? DEFAULT_CONFIG.terminalScrollback,
      history: data.history ?? []
    })
  } else {
    store.set({
      profiles: nextProfiles,
      activeProfileId: nextActiveId,
      history: data.history ?? []
    })
  }

  return getConfig()
}

export function deleteProfile(profileId: string): AppConfig {
  const { data, profiles, activeProfileId } = loadPersistedState()

  if (profiles.length <= 1) {
    throw new Error('至少需要保留一条配置档案')
  }

  if (!profiles.some((p) => p.id === profileId)) {
    throw new Error('配置档案不存在')
  }

  const nextProfiles = profiles.filter((p) => p.id !== profileId)
  const nextActiveId =
    activeProfileId === profileId ? nextProfiles[0].id : activeProfileId

  store.set({
    profiles: nextProfiles,
    activeProfileId: nextActiveId,
    history: data.history ?? []
  })

  return getConfig()
}

export function createEmptyProfile(name: string): AppConfig {
  const { data, profiles } = loadPersistedState()
  const preset = createDefaultProfile(name.trim() || `配置 ${profiles.length + 1}`)

  store.set({
    profiles: [...profiles, preset],
    activeProfileId: preset.id,
    history: data.history ?? []
  })

  return getConfig()
}

export function getHistory(): LaunchRecord[] {
  return store.get('history', [])
}

export function addHistory(record: LaunchRecord): LaunchRecord[] {
  const history = [record, ...getHistory()].slice(0, 50)
  store.set('history', history)
  return history
}

export function clearHistory(): void {
  store.set('history', [])
}

export function getConfigForRenderer(): ConfigView {
  const { profiles, activeProfileId, data } = loadPersistedState()
  const config = buildAppConfig(profiles, activeProfileId, data)
  const { apiKey, ...rest } = config

  return {
    ...rest,
    apiKeyMasked: maskApiKey(apiKey),
    profiles: profiles.map(profileToView)
  }
}

export function toConfigView(config: AppConfig): ConfigView {
  const { profiles, activeProfileId } = loadPersistedState()
  const { apiKey, ...rest } = config

  return {
    ...rest,
    activeProfileId,
    apiKeyMasked: maskApiKey(apiKey),
    profiles: profiles.map(profileToView)
  }
}

export function updateActiveProfileModels(
  baseUrl: string,
  apiKey: string,
  availableModels: AppConfig['availableModels'],
  models: AppConfig['models'],
  modelsFetchedAt: number
): AppConfig {
  const current = getConfig()

  return saveProfile({
    id: current.activeProfileId,
    name: getActiveProfileName(),
    providerId: current.providerId,
    baseUrl,
    apiKey,
    models,
    availableModels,
    modelsFetchedAt
  })
}

export function getActiveProfileLaunchModel(): string {
  const { profiles, activeProfileId } = loadPersistedState()
  const active = getActiveProfile(profiles, activeProfileId)
  return active.lastLaunchModel || active.models.main
}

export function updateProfileLastLaunchModel(profileId: string, model: string): AppConfig {
  const { data, profiles } = loadPersistedState()
  const now = Date.now()

  if (!profiles.some((p) => p.id === profileId)) {
    throw new Error('配置档案不存在')
  }

  const nextProfiles = profiles.map((profile) =>
    profile.id === profileId
      ? { ...profile, lastLaunchModel: model, updatedAt: now }
      : profile
  )

  store.set({
    profiles: nextProfiles,
    activeProfileId: data.activeProfileId,
    history: data.history ?? []
  })

  return getConfig()
}
