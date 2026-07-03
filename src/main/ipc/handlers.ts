import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AppConfig, GlobalSettings, LaunchOptions, ProfileSaveRequest, ProviderRequest } from '../../shared/types'
import {
  createEmptyProfile,
  deleteProfile,
  getActiveProfileLaunchModel,
  getConfig,
  getConfigForRenderer,
  saveGlobalSettings,
  saveProfile,
  switchProfile,
  toConfigView,
  updateActiveProfileModels,
  updateProfileLastLaunchModel
} from '../configStore'
import { recordLaunch, getHistory, clearHistory } from '../history'
import { fetchModels, suggestModelMapping, testConnection } from '../providerService'
import {
  detectClaude,
  launchExternalTerminal,
  resolveClaudePath
} from '../terminal/external'
import {
  isEmbeddedTerminalAvailable,
  isEmbeddedSessionActive,
  killEmbeddedTerminal,
  launchEmbeddedTerminal,
  resizeTerminal,
  writeToTerminal
} from '../terminal/embedded'

let getMainWindow: () => BrowserWindow | null
let lastTerminalSize = { cols: 100, rows: 28 }

function notifyTerminalLaunched(
  result: { mode: 'embedded' | 'external'; fallback?: boolean; message?: string }
): typeof result {
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('terminal:launched', result)
  }
  return result
}

function resolveCredentials(request?: ProviderRequest): { baseUrl: string; apiKey: string } {
  const config = getConfig()
  const baseUrl = request?.baseUrl?.trim() || config.baseUrl
  let apiKey = request?.apiKey?.trim() || config.apiKey

  if (request?.profileId && !request.apiKey?.trim()) {
    const view = getConfigForRenderer()
    const profile = view.profiles.find((p) => p.id === request.profileId)
    if (profile && profile.apiKeyMasked) {
      apiKey = config.apiKey
    }
  }

  if (!baseUrl) {
    throw new Error('请先填写 API Base URL')
  }
  if (!apiKey) {
    throw new Error('请先填写 API Key')
  }

  return { baseUrl, apiKey }
}

async function refreshModelsAndSave(
  baseUrl: string,
  apiKey: string,
  applySuggestions = true
): Promise<ReturnType<typeof toConfigView>> {
  const models = await fetchModels(baseUrl, apiKey)
  const current = getConfig()
  const suggested = applySuggestions ? suggestModelMapping(models) : {}

  const saved = updateActiveProfileModels(
    baseUrl,
    apiKey,
    models,
    applySuggestions
      ? {
          ...current.models,
          ...suggested,
          effortLevel: current.models.effortLevel
        }
      : current.models,
    Date.now()
  )

  return toConfigView(saved)
}

function pickGlobalSettings(partial: Partial<AppConfig>): Partial<GlobalSettings> {
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
  if (partial.terminalFontSize !== undefined) global.terminalFontSize = partial.terminalFontSize
  if (partial.terminalScrollback !== undefined) global.terminalScrollback = partial.terminalScrollback

  return global
}

function buildLaunchConfig(config: AppConfig, modelOverride?: string): AppConfig {
  const launchMain = modelOverride?.trim() || config.models.main
  if (launchMain === config.models.main) return config

  return {
    ...config,
    models: { ...config.models, main: launchMain }
  }
}

async function executeLaunch(
  launchConfig: AppConfig,
  launchMain: string,
  projectPath: string,
  claudePath: string,
  mode: 'embedded' | 'external',
  terminalSize?: { cols: number; rows: number }
): Promise<{ mode: 'embedded' | 'external'; fallback?: boolean; message?: string }> {
  if (mode === 'external') {
    killEmbeddedTerminal()
    await launchExternalTerminal(launchConfig, projectPath, claudePath)
    recordLaunch(projectPath, 'external', launchMain)
    updateProfileLastLaunchModel(launchConfig.activeProfileId, launchMain)
    return notifyTerminalLaunched({ mode: 'external' as const })
  }

  if (!isEmbeddedTerminalAvailable()) {
    killEmbeddedTerminal()
    await launchExternalTerminal(launchConfig, projectPath, claudePath)
    recordLaunch(projectPath, 'external', launchMain)
    updateProfileLastLaunchModel(launchConfig.activeProfileId, launchMain)
    return notifyTerminalLaunched({
      mode: 'external' as const,
      fallback: true,
      message: '内嵌终端不可用，已自动改用外部终端启动'
    })
  }

  const mainWindow = getMainWindow()
  if (!mainWindow) {
    throw new Error('主窗口不可用')
  }

  try {
    await launchEmbeddedTerminal(
      mainWindow,
      launchConfig,
      projectPath,
      claudePath,
      terminalSize ?? lastTerminalSize
    )
    recordLaunch(projectPath, 'embedded', launchMain)
    updateProfileLastLaunchModel(launchConfig.activeProfileId, launchMain)
    return notifyTerminalLaunched({ mode: 'embedded' as const })
  } catch (error) {
    killEmbeddedTerminal()
    await launchExternalTerminal(launchConfig, projectPath, claudePath)
    recordLaunch(projectPath, 'external', launchMain)
    updateProfileLastLaunchModel(launchConfig.activeProfileId, launchMain)
    return notifyTerminalLaunched({
      mode: 'external' as const,
      fallback: true,
      message: `内嵌终端启动失败，已自动改用外部终端：${
        error instanceof Error ? error.message : String(error)
      }`
    })
  }
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow

  ipcMain.handle('config:get', () => getConfigForRenderer())

  ipcMain.handle('config:save', async (_event, partial: Partial<AppConfig>) => {
    const global = pickGlobalSettings(partial)
    const saved = Object.keys(global).length > 0 ? saveGlobalSettings(global) : getConfig()
    return toConfigView(saved)
  })

  ipcMain.handle('profile:switch', (_event, profileId: string) => {
    const saved = switchProfile(profileId)
    return toConfigView(saved)
  })

  ipcMain.handle('profile:save', async (_event, request: ProfileSaveRequest) => {
    const hadNewApiKey = Boolean(request.profile.apiKey?.trim())
    const saved = saveProfile(request.profile, request.global)

    if (hadNewApiKey && saved.apiKey && saved.baseUrl) {
      try {
        return await refreshModelsAndSave(saved.baseUrl, saved.apiKey)
      } catch (error) {
        return {
          ...toConfigView(saved),
          fetchError: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return toConfigView(saved)
  })

  ipcMain.handle('profile:create', (_event, name?: string) => {
    const saved = createEmptyProfile(name ?? '')
    return toConfigView(saved)
  })

  ipcMain.handle('profile:delete', (_event, profileId: string) => {
    const saved = deleteProfile(profileId)
    return toConfigView(saved)
  })

  ipcMain.handle('provider:testConnection', async (_event, request?: ProviderRequest) => {
    const { baseUrl, apiKey } = resolveCredentials(request)
    return testConnection(baseUrl, apiKey)
  })

  ipcMain.handle('provider:fetchModels', async (_event, request?: ProviderRequest) => {
    const { baseUrl, apiKey } = resolveCredentials(request)
    return refreshModelsAndSave(baseUrl, apiKey)
  })

  ipcMain.handle('dialog:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:pickExecutable', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [
              { name: '可执行文件', extensions: ['exe', 'cmd', 'bat'] },
              { name: '全部', extensions: ['*'] }
            ]
          : [{ name: '全部', extensions: ['*'] }]
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('claude:detect', async () => {
    const config = getConfig()
    return detectClaude(config.claudePath || undefined)
  })

  ipcMain.handle('history:get', () => getHistory())

  ipcMain.handle('history:clear', () => {
    clearHistory()
    return []
  })

  ipcMain.handle('shell:openPath', (_event, targetPath: string) => {
    return shell.openPath(targetPath)
  })

  ipcMain.handle('terminal:available', () => isEmbeddedTerminalAvailable())

  ipcMain.handle('terminal:session', () => ({ active: isEmbeddedSessionActive() }))

  ipcMain.handle('terminal:size', () => lastTerminalSize)

  ipcMain.handle('launch', async (_event, options: LaunchOptions) => {
    const config = getConfig()

    if (!config.apiKey) {
      throw new Error('请先在设置中配置 API Key')
    }

    if (!config.baseUrl) {
      throw new Error('请先在设置中配置 API Base URL')
    }

    const projectPath = options.projectPath
    if (!projectPath) {
      throw new Error('请选择项目目录')
    }

    const claudePath = await resolveClaudePath(config)
    const detected = await detectClaude(claudePath)
    if (!detected.found && claudePath === 'claude') {
      throw new Error('未找到 claude 命令，请先运行: npm install -g @anthropic-ai/claude-code')
    }

    let mode = options.mode
    if (!mode) {
      if (config.terminalMode === 'ask') {
        throw new Error('ASK_MODE')
      }
      mode = config.terminalMode === 'external' ? 'external' : 'embedded'
    }

    saveGlobalSettings({ lastProjectPath: projectPath })

    const launchMain = options.model?.trim() || config.models.main
    const launchConfig = buildLaunchConfig(config, launchMain)

    return executeLaunch(
      launchConfig,
      launchMain,
      projectPath,
      claudePath,
      mode,
      options.terminalSize
    )
  })

  ipcMain.on('terminal:write', (_event, data: string) => {
    writeToTerminal(data)
  })

  ipcMain.on('terminal:resize', (_event, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) {
      lastTerminalSize = { cols, rows }
    }
    resizeTerminal(cols, rows)
  })

  ipcMain.handle('terminal:kill', () => {
    killEmbeddedTerminal()
  })
}

export async function quickLaunchFromTray(): Promise<void> {
  const config = getConfig()
  const projectPath = config.lastProjectPath

  if (!projectPath) {
    throw new Error('请先在主界面选择项目目录')
  }

  if (!config.apiKey) {
    throw new Error('请先在设置中配置 API Key')
  }

  const claudePath = await resolveClaudePath(config)
  const mode = config.terminalMode === 'external' ? 'external' : 'embedded'
  const launchMain = getActiveProfileLaunchModel()
  const launchConfig = buildLaunchConfig(config, launchMain)

  await executeLaunch(launchConfig, launchMain, projectPath, claudePath, mode, lastTerminalSize)
}
