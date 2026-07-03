import { useEffect, useState } from 'react'
import type { LaunchRecord } from '@shared/types'
import { formatTerminalMode } from '@shared/types'

export function HistoryPage(): React.JSX.Element {
  const [history, setHistory] = useState<LaunchRecord[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async (): Promise<void> => {
    const records = await window.launcher.getHistory()
    setHistory(records)
  }

  useEffect(() => {
    load()
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
        <div className="env-header" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            启动历史
          </h2>
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.875rem' }} onClick={clear}>
            清空历史
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-muted">暂无启动记录</p>
        ) : (
          <div className="stack">
            {history.map((record) => (
              <div key={record.id} className="history-item">
                <div style={{ fontWeight: 500 }}>{record.projectPath}</div>
                <div className="history-meta">
                  <span>模式: {formatTerminalMode(record.terminalMode)}</span>
                  {record.profileName && <span>配置: {record.profileName}</span>}
                  <span>模型: {record.model}</span>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <div className="row-wrap" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.875rem' }}
                    onClick={() => relaunch(record)}
                  >
                    重新启动
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem' }}
                    onClick={() => window.launcher.openPath(record.projectPath)}
                  >
                    打开目录
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && <p className="text-success-msg" style={{ marginTop: '0.75rem' }}>{message}</p>}
        {error && <p className="text-error-msg" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </section>
    </div>
  )
}
