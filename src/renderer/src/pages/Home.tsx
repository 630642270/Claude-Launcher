import { useEffect, useState } from 'react'
import type { ConfigView, ClaudeDetectionResult, ProfileView } from '@shared/types'
import { formatTerminalMode } from '@shared/types'
import { ProfileList } from '../components/ProfileList'
import { ModelSelect } from '../components/ModelSelect'

function resolveLaunchModel(profile: ProfileView | undefined, config: ConfigView): string {
  if (profile?.lastLaunchModel) return profile.lastLaunchModel
  if (config.models.main) return config.models.main
  return config.availableModels[0]?.id ?? ''
}

interface HomeProps {
  config: ConfigView | null
  onNavigate: (page: 'settings') => void
  onConfigChange: (config: ConfigView) => void
  onTerminalShow: (show: boolean) => void
}

export function Home({
  config,
  onNavigate,
  onConfigChange,
  onTerminalShow
}: HomeProps): React.JSX.Element {
  const [projectPath, setProjectPath] = useState('')
  const [detection, setDetection] = useState<ClaudeDetectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [askMode, setAskMode] = useState(false)
  const [launchModel, setLaunchModel] = useState('')
  const [claudePathInput, setClaudePathInput] = useState('')
  const [savingClaudePath, setSavingClaudePath] = useState(false)

  useEffect(() => {
    if (config?.lastProjectPath) {
      setProjectPath(config.lastProjectPath)
    }
  }, [config?.lastProjectPath])

  useEffect(() => {
    setClaudePathInput(config?.claudePath ?? '')
  }, [config?.claudePath])

  useEffect(() => {
    window.launcher.detectClaude().then(setDetection)
  }, [config?.claudePath])

  useEffect(() => {
    const unsubscribe = window.launcher.onAppError((msg) => setError(msg))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!config) {
      setLaunchModel('')
      return
    }

    const profile = config.profiles.find((item) => item.id === config.activeProfileId)
    setLaunchModel(resolveLaunchModel(profile, config))
  }, [config?.activeProfileId, config?.models.main, config?.availableModels, config?.profiles])

  const pickDirectory = async (): Promise<void> => {
    const selected = await window.launcher.pickDirectory()
    if (selected) setProjectPath(selected)
  }

  const applyClaudePath = async (path?: string): Promise<void> => {
    const trimmed = (path ?? claudePathInput).trim()
    setSavingClaudePath(true)
    setError('')

    try {
      const updated = await window.launcher.saveConfig({ claudePath: trimmed })
      onConfigChange(updated)
      setClaudePathInput(trimmed)
      const result = await window.launcher.detectClaude()
      setDetection(result)
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    } finally {
      setSavingClaudePath(false)
    }
  }

  const pickClaudeExecutable = async (): Promise<void> => {
    const selected = await window.launcher.pickExecutable()
    if (selected) {
      setClaudePathInput(selected)
      await applyClaudePath(selected)
    }
  }

  const restoreAutoClaudePath = async (): Promise<void> => {
    setClaudePathInput('')
    await applyClaudePath('')
  }

  const claudePathHint = config?.claudePath
    ? '已手动指定路径；点击「恢复自动检测」或清空后应用，将重新使用 PATH 中的 claude 命令'
    : detection?.found
      ? `已自动检测到 claude（${detection.path}），留空将使用 PATH 中的命令；也可手动指定其他路径`
      : '未在 PATH 中检测到 claude，请指定 claude.cmd / claude.exe 的完整路径'

  const claudePathPlaceholder =
    detection?.found && !config?.claudePath
      ? `留空使用自动检测（当前: ${detection.path}）`
      : '例如 C:\\Users\\...\\claude.cmd'

  const hasManualClaudePath = Boolean(claudePathInput.trim() || config?.claudePath)

  const switchProfile = async (profileId: string): Promise<void> => {
    if (!config || profileId === config.activeProfileId) return
    const updated = await window.launcher.switchProfile(profileId)
    onConfigChange(updated)
  }

  const activeProfile = config?.profiles.find((profile) => profile.id === config.activeProfileId)

  const launch = async (mode?: 'embedded' | 'external'): Promise<void> => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const freshConfig = await window.launcher.getConfig()

      if (!freshConfig.apiKeyMasked) {
        setError('请先在设置中配置 API Key')
        onNavigate('settings')
        return
      }

      const resolvedMode =
        mode ??
        (freshConfig.terminalMode === 'ask' ? undefined : freshConfig.terminalMode)

      if (resolvedMode === 'embedded') {
        onTerminalShow(true)
        await new Promise((resolve) => window.setTimeout(resolve, 150))
      } else if (resolvedMode === 'external') {
        onTerminalShow(false)
        await window.launcher.killTerminal()
      }

      const terminalSize =
        resolvedMode === 'embedded' ? await window.launcher.getTerminalSize() : undefined
      const result = await window.launcher.launch({
        projectPath,
        mode,
        terminalSize,
        ...(launchModel.trim() ? { model: launchModel.trim() } : {})
      })

      if (result.mode === 'embedded') {
        onTerminalShow(true)
        setMessage('已在内嵌终端启动 Claude Code（兼容 API 环境已隔离注入）')
      } else {
        onTerminalShow(false)
        if (result.fallback && result.message) {
          setMessage(result.message)
        } else {
          setMessage('已在外部终端启动 Claude Code，请查看新弹出的终端窗口（兼容 API 环境已隔离注入）')
        }
      }
      const updated = await window.launcher.getConfig()
      onConfigChange(updated)
      setAskMode(false)
    } catch (err) {
      const text = String(err)
      if (text.includes('ASK_MODE')) {
        setAskMode(true)
      } else {
        setError(text.replace('Error: ', ''))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title">启动 Claude Code</h2>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          环境变量仅注入到 Claude Code 子进程，不会修改系统全局环境。
        </p>

        <div className="stack">
          <label>
            <span className="field-label">项目目录</span>
            <div className="row">
              <input
                className="field-input"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="选择或输入项目路径"
              />
              <button type="button" className="btn btn-secondary shrink-0" onClick={pickDirectory}>
                浏览
              </button>
            </div>
          </label>

          <ProfileList
            compact
            profiles={config?.profiles ?? []}
            activeProfileId={config?.activeProfileId ?? ''}
            onSelect={(profileId) => void switchProfile(profileId)}
          />

          <ModelSelect
            label="启动模型"
            value={launchModel}
            options={config?.availableModels ?? []}
            onChange={setLaunchModel}
          />

          <div className="status-box">
            <div className="status-row">
              <span className="text-muted">Claude Code 检测</span>
              <span className={detection?.found ? 'text-success' : 'text-warning'}>
                {detection?.found ? `已找到: ${detection.path}` : '未检测到 claude 命令'}
              </span>
            </div>
            <div className="status-row">
              <span className="text-muted">当前配置</span>
              <span className={config?.apiKeyMasked ? 'text-success' : 'text-warning'}>
                {activeProfile?.name ?? '未配置'}
                {config?.apiKeyMasked ? ` · ${config.apiKeyMasked}` : activeProfile ? ' · 未配置 Key' : ''}
              </span>
            </div>
            <div className="status-row">
              <span className="text-muted">终端模式</span>
              <span>{formatTerminalMode(config?.terminalMode)}</span>
            </div>
            <div className="status-row">
              <span className="text-muted">启动模型</span>
              <span>{launchModel || config?.models.main || '未设置'}</span>
            </div>
          </div>

          <label>
            <span className="field-label">Claude 可执行文件路径（可选）</span>
            <div className="row">
              <input
                className="field-input"
                value={claudePathInput}
                onChange={(e) => setClaudePathInput(e.target.value)}
                placeholder={claudePathPlaceholder}
              />
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                disabled={savingClaudePath}
                onClick={() => void pickClaudeExecutable()}
              >
                浏览
              </button>
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                disabled={savingClaudePath}
                onClick={() => void applyClaudePath()}
              >
                {savingClaudePath ? '应用中...' : '应用'}
              </button>
              {hasManualClaudePath && (
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  disabled={savingClaudePath}
                  onClick={() => void restoreAutoClaudePath()}
                >
                  恢复自动检测
                </button>
              )}
            </div>
            <p className="text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>
              {claudePathHint}
            </p>
          </label>

          {askMode && (
            <div className="ask-box">
              <p style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>选择启动方式：</p>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={() => launch('embedded')}
                >
                  内嵌终端
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={loading}
                  onClick={() => launch('external')}
                >
                  外部终端
                </button>
              </div>
            </div>
          )}

          <div className="row-wrap">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !projectPath}
              onClick={() => launch()}
            >
              {loading ? '启动中...' : '启动 Claude Code'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onNavigate('settings')}>
              打开设置
            </button>
          </div>

          {error && <p className="text-error-msg">{error}</p>}
          {message && <p className="text-success-msg">{message}</p>}
        </div>
      </section>
    </div>
  )
}
