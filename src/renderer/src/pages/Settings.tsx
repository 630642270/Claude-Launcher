import { useEffect, useRef, useState } from 'react'
import type { ConfigView } from '@shared/types'
import { DEFAULT_CONFIG } from '@shared/types'
import { ProfileCard } from '../components/ProfileCard'
import type { ProfileCardTestResult } from '../components/ProfileCard'
import { ProfileDetail } from '../components/ProfileDetail'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner } from '../components/ui/Spinner'

interface SettingsProps {
  onDirtyChange?: (dirty: boolean) => void
}

interface DeleteTarget {
  id: string
  name: string
}

export function Settings({ onDirtyChange }: SettingsProps): React.JSX.Element {
  const baselineRef = useRef('')
  const [config, setConfig] = useState<ConfigView>({
    ...DEFAULT_CONFIG,
    apiKeyMasked: '',
    profiles: []
  })
  const [savedMessage, setSavedMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [testMessage, setTestMessage] = useState('')
  const [testOk, setTestOk] = useState<boolean | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [detailTarget, setDetailTarget] = useState<string | 'new' | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ProfileCardTestResult | null>>({})
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())

  const applyConfigView = (data: ConfigView): void => {
    const nextConfig: ConfigView = {
      ...DEFAULT_CONFIG,
      ...data,
      apiKeyMasked: data.apiKeyMasked
    }

    baselineRef.current = JSON.stringify(nextConfig)
    setConfig(nextConfig)
  }

  useEffect(() => {
    window.launcher.getConfig().then((data) => {
      applyConfigView(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (loading) {
      onDirtyChange?.(false)
      return
    }
    const snapshot = JSON.stringify(config)
    onDirtyChange?.(snapshot !== baselineRef.current)
  }, [config, onDirtyChange, loading])

  const switchProfile = async (profileId: string): Promise<void> => {
    if (profileId === config.activeProfileId) return
    const updated = await window.launcher.switchProfile(profileId)
    applyConfigView(updated)
    setTestMessage('')
    setTestOk(null)
  }

  const createProfile = (): void => {
    setTestMessage('')
    setTestOk(null)
    setSavedMessage('')
    setDetailTarget('new')
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

  const requestDeleteProfile = (profileId: string): void => {
    const profile = config.profiles.find((item) => item.id === profileId)
    setDeleteTarget({ id: profileId, name: profile?.name || '未命名' })
  }

  const duplicateProfile = async (profileId: string): Promise<void> => {
    try {
      const updated = await window.launcher.duplicateProfile(profileId)
      applyConfigView(updated)
      setSavedMessage('已复制配置档案')
      setTimeout(() => setSavedMessage(''), 2500)
    } catch (error) {
      setTestMessage(String(error).replace('Error: ', ''))
      setTestOk(false)
    }
  }

  const benchmarkCard = async (profileId: string): Promise<void> => {
    const profile = config.profiles.find((p) => p.id === profileId)
    if (!profile) return

    setTestingIds((prev) => new Set(prev).add(profileId))
    setTestResults((prev) => ({ ...prev, [profileId]: null }))

    try {
      const apiKey = await window.launcher.revealApiKey(profile.id)
      const result = await window.launcher.benchmark({
        baseUrl: profile.baseUrl,
        apiKey,
        model: profile.models.main
      })
      setTestResults((prev) => ({
        ...prev,
        [profileId]: { ok: result.ok, message: result.message }
      }))
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [profileId]: { ok: false, message: String(error).replace('Error: ', '') }
      }))
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev)
        next.delete(profileId)
        return next
      })
    }
  }

  const handleDetailSaved = (updated: ConfigView & { fetchError?: string }): void => {
    applyConfigView(updated)
    setDetailTarget(null)
    setSavedMessage('')

    if (updated.fetchError) {
      setTestOk(false)
      setTestMessage(updated.fetchError)
    } else {
      setTestMessage('')
      setTestOk(null)
      setSavedMessage('配置已保存')
      setTimeout(() => setSavedMessage(''), 2500)
    }
  }

  const detailProfile =
    detailTarget !== null && detailTarget !== 'new'
      ? (config.profiles.find((p) => p.id === detailTarget) ?? null)
      : null
  const showDetail = detailTarget !== null && (detailTarget === 'new' || detailProfile !== null)

  if (loading) {
    return (
      <div className="card">
        <Spinner large label="加载设置中..." />
      </div>
    )
  }

  if (showDetail) {
    return (
      <ProfileDetail
        profile={detailTarget === 'new' ? null : detailProfile}
        isActive={detailProfile?.id === config.activeProfileId}
        onBack={() => setDetailTarget(null)}
        onSaved={handleDetailSaved}
      />
    )
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="section-header">
          <h2 className="section-title">API 配置</h2>
          <button type="button" className="btn btn-primary" onClick={createProfile}>
            新增档案
          </button>
        </div>

        <div className="profile-cards">
          {config.profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={profile.id === config.activeProfileId}
              testResult={testResults[profile.id] ?? null}
              testing={testingIds.has(profile.id)}
              canDelete={config.profiles.length > 1}
              onSelect={() => void switchProfile(profile.id)}
              onTest={() => void benchmarkCard(profile.id)}
              onEdit={() => setDetailTarget(profile.id)}
              onCopy={() => void duplicateProfile(profile.id)}
              onDelete={() => requestDeleteProfile(profile.id)}
            />
          ))}
        </div>

        {savedMessage && <p className="text-success-msg">{savedMessage}</p>}
        {testMessage && (
          <p className={testOk ? 'text-success-msg' : 'text-error-msg'}>{testMessage}</p>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        danger
        title="删除配置档案"
        message={`确定要删除档案「${deleteTarget?.name ?? ''}」吗？该档案的 API Key、模型与环境配置将一并移除，且无法撤销。`}
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteTarget) void removeProfile(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}