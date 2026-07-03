import { useEffect, useState } from 'react'
import type { AppConfig, ConfigView, ProviderId } from '@shared/types'
import { DEFAULT_CONFIG, EFFORT_OPTIONS } from '@shared/types'
import { PROVIDER_PRESETS, getProviderPreset } from '@shared/providers'
import { EnvEditor } from '../components/EnvEditor'
import { ModelSelect } from '../components/ModelSelect'
import { ProfileList } from '../components/ProfileList'

type SettingsState = Omit<AppConfig, 'apiKey'> & {
  apiKeyMasked: string
  profiles: ConfigView['profiles']
}

export function Settings(): React.JSX.Element {
  const [config, setConfig] = useState<SettingsState>({
    ...DEFAULT_CONFIG,
    apiKeyMasked: '',
    profiles: []
  })
  const [profileName, setProfileName] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [testOk, setTestOk] = useState<boolean | null>(null)

  const applyConfigView = (data: ConfigView): void => {
    const active = data.profiles.find((profile) => profile.id === data.activeProfileId)

    setConfig({
      ...DEFAULT_CONFIG,
      ...data,
      apiKeyMasked: data.apiKeyMasked
    })
    setProfileName(active?.name ?? '')
    setHasSavedApiKey(Boolean(data.apiKeyMasked))
    setApiKeyInput('')
  }

  useEffect(() => {
    window.launcher.getConfig().then((data) => {
      applyConfigView(data)
      setLoading(false)
    })
  }, [])

  const handleProviderChange = (providerId: ProviderId): void => {
    const preset = getProviderPreset(providerId)
    setConfig((current) => ({
      ...current,
      providerId,
      baseUrl: providerId === 'custom' ? current.baseUrl : preset.baseUrl,
      models:
        providerId === 'custom'
          ? current.models
          : {
              ...current.models,
              ...preset.defaultModels,
              effortLevel: current.models.effortLevel
            }
    }))
  }

  const resolveApiKey = (): string | undefined => {
    const trimmed = apiKeyInput.trim()
    return trimmed || undefined
  }

  const switchProfile = async (profileId: string): Promise<void> => {
    if (profileId === config.activeProfileId) return

    const updated = await window.launcher.switchProfile(profileId)
    applyConfigView(updated)
    setTestMessage('')
    setTestOk(null)
  }

  const createProfile = async (): Promise<void> => {
    const updated = await window.launcher.createProfile(`配置 ${config.profiles.length + 1}`)
    applyConfigView(updated)
    setTestMessage('')
    setTestOk(null)
    setSavedMessage('已新建配置档案')
    setTimeout(() => setSavedMessage(''), 2500)
  }

  const removeProfile = async (profileId: string): Promise<void> => {
    if (config.profiles.length <= 1) return

    try {
      const updated = await window.launcher.deleteProfile(profileId)
      applyConfigView(updated)
      setTestMessage('')
      setTestOk(null)
      setSavedMessage('已删除配置档案')
      setTimeout(() => setSavedMessage(''), 2500)
    } catch (error) {
      setTestMessage(String(error).replace('Error: ', ''))
      setTestOk(false)
    }
  }

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestMessage('')
    setTestOk(null)

    try {
      const result = await window.launcher.testConnection({
        baseUrl: config.baseUrl,
        apiKey: resolveApiKey(),
        profileId: config.activeProfileId
      })

      setTestOk(result.ok)
      setTestMessage(result.message)

      if (result.ok && result.models.length > 0) {
        setConfig((current) => ({
          ...current,
          availableModels: result.models
        }))
      }
    } catch (error) {
      setTestOk(false)
      setTestMessage(String(error).replace('Error: ', ''))
    } finally {
      setTesting(false)
    }
  }

  const refreshModels = async (): Promise<void> => {
    setRefreshing(true)
    setTestMessage('')
    setTestOk(null)

    try {
      const updated = await window.launcher.fetchModels({
        baseUrl: config.baseUrl,
        apiKey: resolveApiKey(),
        profileId: config.activeProfileId
      })
      applyConfigView(updated)
      setTestOk(true)
      setTestMessage(`已刷新模型列表，共 ${updated.availableModels.length} 个模型`)
    } catch (error) {
      setTestOk(false)
      setTestMessage(String(error).replace('Error: ', ''))
    } finally {
      setRefreshing(false)
    }
  }

  const save = async (): Promise<void> => {
    const newKey = resolveApiKey()

    const updated = await window.launcher.saveProfile({
      profile: {
        id: config.activeProfileId,
        name: profileName.trim() || '未命名',
        providerId: config.providerId,
        baseUrl: config.baseUrl,
        apiKey: newKey,
        models: config.models,
        availableModels: config.availableModels,
        modelsFetchedAt: config.modelsFetchedAt
      },
      global: {
        customEnv: config.customEnv,
        terminalMode: config.terminalMode,
        externalTerminal: config.externalTerminal,
        claudePath: config.claudePath,
        minimizeToTray: config.minimizeToTray,
        disableNonessentialTraffic: config.disableNonessentialTraffic,
        terminalFontSize: config.terminalFontSize,
        terminalScrollback: config.terminalScrollback
      }
    })

    applyConfigView(updated)

    if (updated.fetchError) {
      setTestOk(false)
      setTestMessage(updated.fetchError)
      setSavedMessage('设置已保存，但自动获取模型失败')
    } else if (newKey && updated.availableModels.length > 0) {
      setTestOk(true)
      setTestMessage(`已自动获取 ${updated.availableModels.length} 个可用模型`)
      setSavedMessage('设置已保存')
    } else {
      setSavedMessage('设置已保存')
    }

    setTimeout(() => setSavedMessage(''), 2500)
  }

  if (loading) {
    return <div className="card">加载设置中...</div>
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="section-title">API 配置</h2>

        <ProfileList
          profiles={config.profiles}
          activeProfileId={config.activeProfileId}
          onSelect={(profileId) => void switchProfile(profileId)}
          onCreate={() => void createProfile()}
          onDelete={(profileId) => void removeProfile(profileId)}
        />

        <h3 className="profile-edit-title">编辑：{profileName || '未命名'}</h3>

        <label>
          <span className="field-label">档案名称</span>
          <input
            className="field-input"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="例如：LongCat 主账号"
          />
        </label>

        <label>
          <span className="field-label">提供商预设</span>
          <select
            className="field-input"
            value={config.providerId}
            onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
          >
            {PROVIDER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">API Key</span>
          <div className="row">
            <input
              className="field-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasSavedApiKey ? '已保存（留空则不修改）' : '输入 API Key'}
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={() => setShowApiKey((v) => !v)}
            >
              {showApiKey ? '隐藏' : '显示'}
            </button>
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              disabled={testing || (!hasSavedApiKey && !apiKeyInput.trim())}
              onClick={testConnection}
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
          </div>
        </label>

        <label>
          <span className="field-label">API Base URL</span>
          <input
            className="field-input"
            value={config.baseUrl}
            onChange={(e) =>
              setConfig({ ...config, baseUrl: e.target.value, providerId: 'custom' })
            }
            placeholder="https://api.example.com/anthropic"
          />
        </label>

        {testMessage && (
          <p className={testOk ? 'text-success-msg' : 'text-error-msg'}>{testMessage}</p>
        )}
      </section>

      <section className="card stack">
        <div className="env-header">
          <h2 className="section-title" style={{ margin: 0 }}>
            模型配置
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.875rem' }}
            disabled={refreshing || (!hasSavedApiKey && !apiKeyInput.trim())}
            onClick={refreshModels}
          >
            {refreshing ? '刷新中...' : '刷新模型列表'}
          </button>
        </div>

        {config.modelsFetchedAt ? (
          <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            上次拉取：{new Date(config.modelsFetchedAt).toLocaleString()}（
            {config.availableModels.length} 个模型，下方下拉可全部选择）
          </p>
        ) : (
          <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem' }}>
            保存 API Key 或点击测试连接后，将自动获取可用模型
          </p>
        )}

        {config.availableModels.length > 0 && (
          <div className="model-catalog">
            {config.availableModels.map((model) => (
              <span key={model.id} className="model-chip" title={model.id}>
                {model.displayName && model.displayName !== model.id
                  ? model.displayName
                  : model.id}
              </span>
            ))}
          </div>
        )}

        <div className="grid-2">
          <ModelSelect
            label="主模型"
            value={config.models.main}
            options={config.availableModels}
            onChange={(main) => setConfig({ ...config, models: { ...config.models, main } })}
          />
          <ModelSelect
            label="Opus 模型"
            value={config.models.opus}
            options={config.availableModels}
            onChange={(opus) => setConfig({ ...config, models: { ...config.models, opus } })}
          />
          <ModelSelect
            label="Sonnet 模型"
            value={config.models.sonnet}
            options={config.availableModels}
            onChange={(sonnet) => setConfig({ ...config, models: { ...config.models, sonnet } })}
          />
          <ModelSelect
            label="Haiku 模型"
            value={config.models.haiku}
            options={config.availableModels}
            onChange={(haiku) => setConfig({ ...config, models: { ...config.models, haiku } })}
          />
          <ModelSelect
            label="Subagent 模型"
            value={config.models.subagent}
            options={config.availableModels}
            onChange={(subagent) =>
              setConfig({ ...config, models: { ...config.models, subagent } })
            }
          />
          <label>
            <span className="field-label">Effort Level</span>
            <select
              className="field-input"
              value={config.models.effortLevel}
              onChange={(e) =>
                setConfig({
                  ...config,
                  models: { ...config.models, effortLevel: e.target.value }
                })
              }
            >
              {EFFORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title">启动选项</h2>

        <label>
          <span className="field-label">终端模式</span>
          <select
            className="field-input"
            value={config.terminalMode}
            onChange={(e) =>
              setConfig({
                ...config,
                terminalMode: e.target.value as AppConfig['terminalMode']
              })
            }
          >
            <option value="embedded">内嵌终端</option>
            <option value="external">外部终端</option>
            <option value="ask">每次启动询问</option>
          </select>
        </label>

        <label>
          <span className="field-label">终端字体大小</span>
          <input
            className="field-input"
            type="number"
            min={10}
            max={24}
            value={config.terminalFontSize}
            onChange={(e) =>
              setConfig({
                ...config,
                terminalFontSize: Number(e.target.value) || 14
              })
            }
          />
        </label>

        <label>
          <span className="field-label">终端滚动缓冲区行数</span>
          <input
            className="field-input"
            type="number"
            min={500}
            max={10000}
            step={500}
            value={config.terminalScrollback}
            onChange={(e) =>
              setConfig({
                ...config,
                terminalScrollback: Number(e.target.value) || 2000
              })
            }
          />
        </label>

        <label>
          <span className="field-label">外部终端偏好</span>
          <select
            className="field-input"
            value={config.externalTerminal}
            onChange={(e) =>
              setConfig({
                ...config,
                externalTerminal: e.target.value as AppConfig['externalTerminal']
              })
            }
          >
            <option value="wt">Windows Terminal</option>
            <option value="powershell">PowerShell</option>
            <option value="cmd">CMD</option>
          </select>
        </label>

        <label>
          <span className="field-label">Claude 可执行文件路径（可选）</span>
          <div className="row">
            <input
              className="field-input"
              value={config.claudePath}
              onChange={(e) => setConfig({ ...config, claudePath: e.target.value })}
              placeholder="留空则自动检测 claude 命令"
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={async () => {
                const selected = await window.launcher.pickExecutable()
                if (selected) setConfig({ ...config, claudePath: selected })
              }}
            >
              浏览
            </button>
          </div>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.minimizeToTray}
            onChange={(e) => setConfig({ ...config, minimizeToTray: e.target.checked })}
          />
          关闭窗口时最小化到系统托盘
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.disableNonessentialTraffic}
            onChange={(e) =>
              setConfig({ ...config, disableNonessentialTraffic: e.target.checked })
            }
          />
          禁用非必要网络请求 (CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)
        </label>
      </section>

      <section className="card">
        <EnvEditor
          value={config.customEnv}
          onChange={(customEnv) => setConfig({ ...config, customEnv })}
        />
      </section>

      <div className="row" style={{ alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={save}>
          保存设置
        </button>
        {savedMessage && <span className="text-success-msg">{savedMessage}</span>}
      </div>
    </div>
  )
}
