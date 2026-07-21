import { useEffect, useState } from 'react'
import type { LaunchRecord } from '@shared/types'
import { formatTerminalMode } from '@shared/types'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner } from '../components/ui/Spinner'

export function HistoryPage(): React.JSX.Element {
  const [history, setHistory] = useState<LaunchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  const load = async (): Promise<void> => {
    const records = await window.launcher.getHistory()
    setHistory(records)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const relaunch = async (record: LaunchRecord): Promise<void> => {
    setError('')
    setMessage('')
    try {
      const terminalSize =
        record.terminalMode === 'embedded' ? await window.launcher.getTerminalSize() : undefined
      await window.launcher.launch({
        projectPath: record.projectPath,
        mode: record.terminalMode,
        terminalSize,
        ...(record.model ? { model: record.model } : {})
      })
      setMessage(`已重新启动: ${record.projectPath}`)
      await load()
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    }
  }

  const clear = async (): Promise<void> => {
    const records = await window.launcher.clearHistory()
    setHistory(records)
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="section-header">
          <h2 className="section-title">启动历史</h2>
          {history.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmClear(true)}
            >
              清空历史
            </button>
          )}
        </div>

        {loading ? (
          <Spinner large label="加载历史中..." />
        ) : history.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <p className="empty-state-text">暂无启动记录</p>
            <p className="empty-state-sub">从主界面启动 Claude Code 后，记录会出现在这里</p>
          </div>
        ) : (
          <div className="stack">
            {history.map((record) => (
              <div key={record.id} className="history-item">
                <div className="history-path">{record.projectPath}</div>
                <div className="history-meta">
                  <span>模式: {formatTerminalMode(record.terminalMode)}</span>
                  {record.profileName && <span>配置: {record.profileName}</span>}
                  <span>模型: {record.model}</span>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <div className="row-wrap history-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => relaunch(record)}
                  >
                    重新启动
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.launcher.openPath(record.projectPath)}
                  >
                    打开目录
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && <p className="text-success-msg history-feedback">{message}</p>}
        {error && <p className="text-error-msg history-feedback">{error}</p>}
      </section>

      <ConfirmDialog
        open={confirmClear}
        danger
        title="清空启动历史"
        message={`将删除全部 ${history.length} 条启动记录，此操作无法撤销。确定继续吗？`}
        confirmLabel="全部清空"
        onConfirm={() => {
          void clear()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}