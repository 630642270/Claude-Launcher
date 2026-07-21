import type { ProfileView } from '@shared/types'

interface ProfileListProps {
  profiles: ProfileView[]
  activeProfileId: string
  onSelect: (profileId: string) => void
  onCreate?: () => void
  onDelete?: (profileId: string) => void
  compact?: boolean
}

function formatProfileMeta(profile: ProfileView): string {
  const keyLabel = profile.apiKeyMasked || '未配置 Key'
  const modelLabel = profile.models.main || '未设置模型'
  return `${keyLabel} · ${modelLabel}`
}

export function ProfileList({
  profiles,
  activeProfileId,
  onSelect,
  onCreate,
  onDelete,
  compact = false
}: ProfileListProps): React.JSX.Element {
  const canDelete = Boolean(onDelete) && profiles.length > 1

  return (
    <div className="profile-list-wrap">
      {onCreate && (
        <div className="profile-list-header">
          <span className="field-label" style={{ margin: 0 }}>
            配置档案
          </span>
          <button type="button" className="btn btn-secondary profile-list-create-btn" onClick={onCreate}>
            新建档案
          </button>
        </div>
      )}

      <div className={`profile-list ${compact ? 'profile-list-compact' : ''}`}>
        {profiles.length === 0 ? (
          <p className="text-muted profile-list-empty">暂无配置档案</p>
        ) : (
          profiles.map((profile) => {
            const isActive = profile.id === activeProfileId

            return (
              <div
                key={profile.id}
                className={`profile-list-item ${isActive ? 'profile-list-item-active' : ''}`}
              >
                <button
                  type="button"
                  className="profile-list-select"
                  onClick={() => onSelect(profile.id)}
                >
                  <div className="profile-list-title-row">
                    <span className="profile-list-name">{profile.name}</span>
                    {isActive && <span className="profile-list-badge">当前</span>}
                  </div>
                  <div className="profile-list-meta">{formatProfileMeta(profile)}</div>
                </button>

                {onDelete && (
                  <button
                    type="button"
                    className="btn btn-secondary profile-list-delete-btn"
                    disabled={!canDelete}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(profile.id)
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
