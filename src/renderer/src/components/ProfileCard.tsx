import type { ProfileView } from '@shared/types'

export interface ProfileCardTestResult {
  ok: boolean
  message: string
}

interface ProfileCardProps {
  profile: ProfileView
  isActive: boolean
  testResult?: ProfileCardTestResult | null
  testing?: boolean
  canDelete: boolean
  onSelect: () => void
  onTest: () => void
  onEdit: () => void
  onCopy: () => void
  onDelete: () => void
}

export function ProfileCard({
  profile,
  isActive,
  testResult,
  testing = false,
  canDelete,
  onSelect,
  onTest,
  onEdit,
  onCopy,
  onDelete
}: ProfileCardProps): React.JSX.Element {
  const modelLabel = profile.models.main || '未设置模型'

  return (
    <div
      className={`profile-card ${isActive ? 'profile-card-active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="profile-card-header">
        <div className="profile-card-title-group">
          <span className="profile-card-name">{profile.name}</span>
          {isActive && <span className="profile-card-current-badge">当前</span>}
        </div>
      </div>

      <div className="profile-card-subtitle">{modelLabel}</div>

      <div className="profile-card-fields">
        <div className="profile-card-field">
          <span className="profile-card-field-label">HOST</span>
          <span className="profile-card-field-value" title={profile.baseUrl}>
            {profile.baseUrl || '未配置'}
          </span>
        </div>
        <div className="profile-card-field">
          <span className="profile-card-field-label">API KEY</span>
          <span className="profile-card-field-value">
            {profile.apiKeyMasked || '未配置'}
          </span>
        </div>
      </div>

      {testResult && (
        <div
          className={`profile-card-test ${testResult.ok ? 'profile-card-test-ok' : 'profile-card-test-fail'}`}
        >
          <span className="profile-card-test-label">
            测速 {testResult.ok ? '成功' : '失败'}
          </span>
          <span className="profile-card-test-msg">{testResult.message}</span>
        </div>
      )}

      <div className="profile-card-actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="profile-card-action-btn"
          disabled={testing}
          onClick={onTest}
        >
          {testing ? '测速中...' : '测速'}
        </button>
        <button type="button" className="profile-card-action-btn" onClick={onEdit}>
          编辑
        </button>
        <button type="button" className="profile-card-action-btn" onClick={onCopy}>
          复制
        </button>
        <button
          type="button"
          className="profile-card-action-btn profile-card-action-danger"
          disabled={!canDelete}
          onClick={onDelete}
        >
          删除
        </button>
      </div>
    </div>
  )
}