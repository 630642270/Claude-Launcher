const { contextBridge } = require('electron')

const callbacks = {
  terminalLaunched: [],
  terminalSession: [],
  terminalData: [],
  terminalExit: [],
  appError: []
}

const mockProfiles = [
  {
    id: 'profile-deepseek',
    name: 'DeepSeek 主力',
    providerId: 'deepseek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    modelsUrl: '',
    models: {
      main: 'deepseek-v4-pro[1m]',
      opus: 'deepseek-v4-pro[1m]',
      sonnet: 'deepseek-v4-pro[1m]',
      haiku: 'deepseek-v4-flash',
      subagent: 'deepseek-v4-flash',
      effortLevel: 'max'
    },
    availableModels: [
      { id: 'deepseek-v4-pro[1m]', displayName: 'DeepSeek V4 Pro (1M)' },
      { id: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash' }
    ],
    apiKeyMasked: 'sk-a****b12c',
    lastLaunchModel: 'deepseek-v4-pro[1m]',
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 3600000
  },
  {
    id: 'profile-longcat',
    name: 'LongCat 备用',
    providerId: 'longcat',
    baseUrl: 'https://api.longcat.chat/anthropic',
    modelsUrl: '',
    models: {
      main: 'LongCat-2.0',
      opus: 'LongCat-2.0',
      sonnet: 'LongCat-2.0',
      haiku: 'LongCat-2.0',
      subagent: 'LongCat-2.0',
      effortLevel: 'high'
    },
    availableModels: [{ id: 'LongCat-2.0', displayName: 'LongCat 2.0' }],
    apiKeyMasked: 'lc-****9f3a',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000
  }
]

const activeProfile = mockProfiles[0]

const mockConfig = {
  activeProfileId: activeProfile.id,
  providerId: activeProfile.providerId,
  apiKeyMasked: activeProfile.apiKeyMasked,
  baseUrl: activeProfile.baseUrl,
  modelsUrl: activeProfile.modelsUrl,
  models: activeProfile.models,
  availableModels: activeProfile.availableModels,
  customEnv: [],
  terminalMode: 'embedded',
  externalTerminal: 'wt',
  claudePath: '',
  lastProjectPath: 'C:\\Projects\\my-app',
  minimizeToTray: true,
  disableNonessentialTraffic: true,
  dangerouslySkipPermissions: false,
  terminalFontSize: 14,
  terminalScrollback: 2000,
  profiles: mockProfiles
}

const mockHistory = [
  {
    id: 'hist-1',
    projectPath: 'C:\\Projects\\Claude-Launcher',
    terminalMode: 'embedded',
    timestamp: Date.now() - 3600000,
    model: 'deepseek-v4-pro[1m]',
    profileName: 'DeepSeek 主力'
  },
  {
    id: 'hist-2',
    projectPath: 'C:\\Projects\\my-app',
    terminalMode: 'external',
    timestamp: Date.now() - 86400000,
    model: 'deepseek-v4-flash',
    profileName: 'DeepSeek 主力'
  }
]

function emitTerminalData(data) {
  for (const cb of callbacks.terminalData) {
    cb(data)
  }
}

function subscribe(name, callback) {
  callbacks[name].push(callback)
  return () => {
    callbacks[name] = callbacks[name].filter((item) => item !== callback)
  }
}

const launcher = {
  getConfig: () => Promise.resolve(structuredClone(mockConfig)),
  saveConfig: (partial) => {
    Object.assign(mockConfig, partial)
    return Promise.resolve(structuredClone(mockConfig))
  },
  revealApiKey: (profileId) =>
    Promise.resolve(profileId === 'profile-longcat' ? 'lc-demo-key-9f3a' : 'sk-demo-key-b12c'),
  switchProfile: (profileId) => {
    const profile = mockProfiles.find((item) => item.id === profileId)
    if (profile) {
      mockConfig.activeProfileId = profileId
      mockConfig.providerId = profile.providerId
      mockConfig.baseUrl = profile.baseUrl
      mockConfig.models = profile.models
      mockConfig.availableModels = profile.availableModels
      mockConfig.apiKeyMasked = profile.apiKeyMasked
    }
    return Promise.resolve(structuredClone(mockConfig))
  },
  saveProfile: () => Promise.resolve(structuredClone(mockConfig)),
  createProfile: () => Promise.resolve(structuredClone(mockConfig)),
  deleteProfile: () => Promise.resolve(structuredClone(mockConfig)),
  testConnection: () =>
    Promise.resolve({
      ok: true,
      message: '连接成功，已获取 2 个可用模型',
      models: mockConfig.availableModels
    }),
  fetchModels: () => Promise.resolve(structuredClone(mockConfig)),
  pickDirectory: () => Promise.resolve('C:\\Projects\\my-app'),
  pickExecutable: () => Promise.resolve('C:\\npm\\claude.cmd'),
  detectClaude: () =>
    Promise.resolve({
      found: true,
      path: 'C:\\Users\\demo\\AppData\\Roaming\\npm\\claude.cmd'
    }),
  launch: async (options) => {
    if (!options.mode || options.mode === 'embedded') {
      for (const cb of callbacks.terminalLaunched) {
        cb({ mode: 'embedded' })
      }
      for (const cb of callbacks.terminalSession) {
        cb({ active: true })
      }
      setTimeout(() => {
        emitTerminalData('\x1b[1;36mClaude Code\x1b[0m — Anthropic-compatible API environment\r\n\r\n')
        emitTerminalData('\x1b[90m$ \x1b[0mclaude\r\n')
        emitTerminalData('\x1b[32m✓\x1b[0m Connected to deepseek-v4-pro[1m]\r\n')
        emitTerminalData('\x1b[90m> \x1b[0mHow can I help you with your project today?\r\n')
      }, 300)
      return { mode: 'embedded' }
    }
    return { mode: 'external' }
  },
  isEmbeddedTerminalAvailable: () => Promise.resolve(true),
  getTerminalSize: () => Promise.resolve({ cols: 100, rows: 24 }),
  getTerminalSession: () => Promise.resolve({ active: false }),
  getHistory: () => Promise.resolve(structuredClone(mockHistory)),
  clearHistory: () => Promise.resolve([]),
  openPath: () => Promise.resolve(''),
  killTerminal: () => Promise.resolve(),
  onTerminalData: (callback) => {
    const unsubscribe = subscribe('terminalData', callback)
    return unsubscribe
  },
  onTerminalExit: (callback) => subscribe('terminalExit', callback),
  onTerminalLaunched: (callback) => subscribe('terminalLaunched', callback),
  onTerminalSession: (callback) => subscribe('terminalSession', callback),
  onAppError: (callback) => subscribe('appError', callback),
  writeTerminal: () => {},
  resizeTerminal: () => {}
}

contextBridge.exposeInMainWorld('launcher', launcher)
