import { useEffect, useRef, useState } from 'react'
import type {
  AvailableModel,
  BenchmarkResult,
  ConfigView,
  ConnectionTestResult,
  ModelConfig,
  ProfileInput,
  ProfileView
} from '@shared/types'
import { EFFORT_OPTIONS, EMPTY_MODELS } from '@shared/types'
import { ModelSelect } from './ModelSelect'
import { Select } from './Select'
import { Field } from './ui/Field'

interface ProfileDetailProps {
  /** null 表示新建模式 */
  profile: ProfileView | null
  isActive: boolean
  onBack: () => void
  onSaved: (updated: ConfigView & { fetchError?: string }) => void
}

function formatError(error: unknown): string {
  return String(error).replace('Error: ', '')
}

export function ProfileDetail({ profile, isActive, onBack, onSaved }: ProfileDetailProps): React.JSX.Element {
  const isNew = profile === null

  const [name, setName] = useState(profile?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(profile?.baseUrl ?? '')
  const [modelsUrl, setModelsUrl] = useState(profile?.modelsUrl ?? '')
  const [models, setModels] = useState<ModelConfig>(profile?.models ?? { ...EMPTY_MODELS })
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>(profile?.availableModels ?? [])
  const [modelsFetchedAt, setModelsFetchedAt] = useState<number | undefined>(profile?.modelsFetchedAt)

  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [revealingApiKey, setRevealingApiKey] = useState(false)
  const [apiKeyError, setApiKeyError] = useState('')
  const revealRequestIdRef = useRef(0)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [benchmarking, setBenchmarking] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    document.querySelector('.window-body')?.scrollTo({ top: 0 })
  }, [])

  const hasSavedKey = Boolean(profile?.apiKeyMasked)

  const toggleApiKeyVisibility = async (): Promise<void> => {
    if (showApiKey) {
      setShowApiKey(false)
      if (hasSavedKey && !apiKeyDirty) setApiKeyInput('')
      return
    }
    if (apiKeyInput || !hasSavedKey || !profile) {
      setShowApiKey(true)
      return
    }

    setRevealingApiKey(true)
    setApiKeyError('')
    const requestId = ++revealRequestIdRef.current

    try {
      const key = await window.launcher.revealApiKey(profile.id)
      if (revealRequestIdRef.current !== requestId) return
      if (!key) {
        setApiKeyError('当前配置没有可显示的 API Key')
        return
      }
      setApiKeyInput(key)
      setApiKeyDirty(false)
      setShowApiKey(true)
    } catch (error) {
      if (revealRequestIdRef.current === requestId) {
        setApiKeyError(formatError(error))
      }
    } finally {
      if (revealRequestIdRef.current === requestId) setRevealingApiKey(false)
    }
  }

  /** 取当前表单可用于请求的 Key：优先输入框新值，其次读取已保存的 Key */
  const resolveFormApiKey = async (): Promise<string> => {
    if (apiKeyDirty) return apiKeyInput.trim()
    if (profile && hasSavedKey) {
      return await window.launcher.revealApiKey(profile.id)
    }
    return ''
  }

  const runConnectionCheck = async (): Promise<void> => {
    setTestResult(null)
    setSaveError('')

    let apiKey = ''
    try {
      apiKey = await resolveFormApiKey()
    } catch (error) {
      setTestResult({ ok: false, message: formatError(error), models: [] })
      return
    }

    if (!apiKey) {
      setTestResult({ ok: false, message: '请先填写 API Key', models: [] })
      return
    }

    setTesting(true)
    try {
      const result = await window.launcher.testConnection({ baseUrl, modelsUrl, apiKey })
      setTestResult(result)
      if (result.ok && result.models.length > 0) {
        setAvailableModels(result.models)
        setModelsFetchedAt(Date.now())
      }
    } catch (error) {
      setTestResult({ ok: false, message: formatError(error), models: [] })
    } finally {
      setTesting(false)
    }
  }

  /** 发起一次真实流式对话，测量首字延迟与生成吞吐 */
  const runBenchmark = async (): Promise<void> => {
    setBenchmarkResult(null)
    setSaveError('')

    if (!models.main.trim()) {
      setBenchmarkResult({ ok: false, message: '请先选择主模型' })
      return
    }

    let apiKey = ''
    try {
      apiKey = await resolveFormApiKey()
    } catch (error) {
      setBenchmarkResult({ ok: false, message: formatError(error) })
      return
    }

    if (!apiKey) {
      setBenchmarkResult({ ok: false, message: '请先填写 API Key' })
      return
    }

    setBenchmarking(true)
    try {
      const result = await window.launcher.benchmark({ baseUrl, apiKey, model: models.main })
      setBenchmarkResult(result)
    } catch (error) {
      setBenchmarkResult({ ok: false, message: formatError(error) })
    } finally {
      setBenchmarking(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setSaveError('')
    try {
      const input: ProfileInput = {
        id: profile?.id,
        name: name.trim() || '未命名',
        baseUrl,
        modelsUrl,
        apiKey: apiKeyDirty ? apiKeyInput.trim() || undefined : undefined,
        models,
        availableModels,
        modelsFetchedAt
      }
      const updated = await window.launcher.saveProfile({ profile: input })
      onSaved(updated)
    } catch (error) {
      setSaveError(formatError(error))
    } finally {
      setSaving(false)
    }
  }

  const setModel = (key: keyof Omit<ModelConfig, 'effortLevel'>, value: string): void => {
    setModels((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <>
    <div className="profile-detail">
      <header className="detail-header">
        <button type="button" className="detail-back-btn" onClick={onBack}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回档案列表
        </button>

        <div className="detail-heading">
          <h2 className="detail-title">{isNew ? '新建档案' : '档案详情'}</h2>
          {!isNew && isActive && <span className="detail-active-badge">当前使用</span>}
        </div>
        <p className="detail-subtitle">
          {isNew
            ? '填写 API 信息并选择模型，保存后即可在启动时使用'
            : `正在编辑「${name.trim() || '未命名'}」`}
        </p>
      </header>

      <section className="card stack detail-section">
        <div className="section-header">
          <h3 className="section-title">基本信息</h3>
        </div>

        <Field label="档案名称">
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：LongCat 主账号"
          />
        </Field>

        <Field label="API Key">
          <div className="row">
            <input
              className="field-input"
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value)
                setApiKeyDirty(true)
                setApiKeyError('')
              }}
              placeholder={hasSavedKey ? '已保存（留空则不修改）' : '输入 API Key'}
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              disabled={revealingApiKey}
              onClick={() => void toggleApiKeyVisibility()}
            >
              {revealingApiKey ? '读取中...' : showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
          {apiKeyError && <p className="text-error-msg">{apiKeyError}</p>}
        </Field>

        <Field label="API Base URL">
          <input
            className="field-input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/anthropic"
          />
        </Field>

        <Field label="模型列表地址（可选）" hint="留空则使用 Base URL/v1/models">
          <input
            className="field-input"
            value={modelsUrl}
            onChange={(e) => setModelsUrl(e.target.value)}
            placeholder="留空则用 Base URL/v1/models"
          />
        </Field>

        <div className="detail-test-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={benchmarking}
            onClick={() => void runBenchmark()}
          >
            {benchmarking ? '测速中...' : '测试'}
          </button>
          {benchmarkResult && (
            <p className={benchmarkResult.ok ? 'text-success-msg' : 'text-error-msg'}>
              {benchmarkResult.message}
            </p>
          )}
        </div>
      </section>

      <section className="card stack detail-section">
        <div className="section-header">
          <h3 className="section-title">模型配置</h3>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={testing}
            onClick={() => void runConnectionCheck()}
          >
            {testing ? '拉取中...' : '拉取模型'}
          </button>
        </div>

        {testResult && !testResult.ok && <p className="text-error-msg">{testResult.message}</p>}

        {modelsFetchedAt ? (
          <p className="hint-text">
            上次拉取：{new Date(modelsFetchedAt).toLocaleString()}（{availableModels.length} 个模型，
            下方下拉可全部选择）
          </p>
        ) : (
          <p className="hint-text">拉取成功后，将自动填充可用模型</p>
        )}

        {availableModels.length > 0 && (
          <div className="model-catalog">
            {availableModels.map((model) => (
              <span key={model.id} className="model-chip" title={model.id}>
                {model.displayName && model.displayName !== model.id ? model.displayName : model.id}
              </span>
            ))}
          </div>
        )}

        <div className="grid-2">
          <ModelSelect
            label="主模型"
            value={models.main}
            options={availableModels}
            onChange={(main) => setModel('main', main)}
          />
          <ModelSelect
            label="Opus 模型"
            value={models.opus}
            options={availableModels}
            onChange={(opus) => setModel('opus', opus)}
          />
          <ModelSelect
            label="Sonnet 模型"
            value={models.sonnet}
            options={availableModels}
            onChange={(sonnet) => setModel('sonnet', sonnet)}
          />
          <ModelSelect
            label="Haiku 模型"
            value={models.haiku}
            options={availableModels}
            onChange={(haiku) => setModel('haiku', haiku)}
          />
          <ModelSelect
            label="Subagent 模型"
            value={models.subagent}
            options={availableModels}
            onChange={(subagent) => setModel('subagent', subagent)}
          />
          <Select
            label="Effort Level"
            value={models.effortLevel}
            options={EFFORT_OPTIONS.map((option) => ({ value: option, label: option }))}
            onChange={(effortLevel) => setModels((prev) => ({ ...prev, effortLevel }))}
          />
        </div>
      </section>
      </div>

      {/* 操作栏与 .profile-detail 平级，直接挂在 .window-body 下：
          不受 max-width:780px 约束，背景可铺满整个滚动区，按钮相对整窗居中 */}
      <div className="form-actions detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          取消
        </button>
        {saveError && <p className="text-error-msg">{saveError}</p>}
      </div>
    </>
  )
}