import { useCallback, useEffect, useState } from 'react'
import type { ConfigView } from '@shared/types'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { HistoryPage } from './pages/History'
import { TerminalView } from './components/TerminalView'

type Page = 'home' | 'settings' | 'history'

function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>('home')
  const [config, setConfig] = useState<ConfigView | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [focusTerminal, setFocusTerminal] = useState(false)

  const refreshConfig = async (): Promise<void> => {
    const data = await window.launcher.getConfig()
    setConfig(data)
  }

  useEffect(() => {
    refreshConfig()
    window.launcher.getTerminalSession().then((state) => setSessionActive(state.active))
  }, [])

  useEffect(() => {
    if (page === 'home' || page === 'settings') {
      refreshConfig()
    }
  }, [page])

  useEffect(() => {
    const unsubscribeLaunched = window.launcher.onTerminalLaunched((result) => {
      if (result.mode === 'embedded') {
        setShowTerminal(true)
        setPage('home')
        setFocusTerminal(true)
      } else {
        setShowTerminal(false)
      }
    })

    const unsubscribeSession = window.launcher.onTerminalSession((state) => {
      setSessionActive(state.active)
    })

    return () => {
      unsubscribeLaunched()
      unsubscribeSession()
    }
  }, [])

  const handleTerminalClose = useCallback(async (): Promise<void> => {
    await window.launcher.killTerminal()
    setShowTerminal(false)
  }, [])

  const handleTerminalRelaunch = useCallback(async (): Promise<void> => {
    const freshConfig = await window.launcher.getConfig()
    if (!freshConfig.lastProjectPath) return

    const terminalSize = await window.launcher.getTerminalSize()
    await window.launcher.launch({
      projectPath: freshConfig.lastProjectPath,
      mode: 'embedded',
      terminalSize
    })
  }, [])

  const handleKillSession = useCallback(async (): Promise<void> => {
    await window.launcher.killTerminal()
    setShowTerminal(false)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div>
            <h1 className="app-title">Claude Launcher</h1>
            <p className="app-subtitle">Claude Code 兼容 API 隔离环境启动器</p>
          </div>
          <nav className="app-nav">
            <button
              type="button"
              className={`nav-link ${page === 'home' ? 'nav-link-active' : ''}`}
              onClick={() => setPage('home')}
            >
              启动
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'settings' ? 'nav-link-active' : ''}`}
              onClick={() => setPage('settings')}
            >
              设置
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'history' ? 'nav-link-active' : ''}`}
              onClick={() => setPage('history')}
            >
              历史
            </button>
            {sessionActive && (
              <span className="session-indicator">
                内嵌会话运行中
                <button type="button" className="session-kill-btn" onClick={() => void handleKillSession()}>
                  终止
                </button>
              </span>
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {page === 'home' && (
          <Home
            config={config}
            onNavigate={setPage}
            onConfigChange={setConfig}
            onTerminalShow={setShowTerminal}
          />
        )}
        {page === 'settings' && <Settings />}
        {page === 'history' && <HistoryPage />}

        <div className={`terminal-panel ${showTerminal ? 'terminal-panel-visible' : 'terminal-panel-hidden'}`}>
          <section className="card min-h-terminal-card">
            <TerminalView
              active={showTerminal}
              fontSize={config?.terminalFontSize ?? 14}
              scrollback={config?.terminalScrollback ?? 2000}
              focusRequested={focusTerminal}
              onFocusHandled={() => setFocusTerminal(false)}
              onClose={() => void handleTerminalClose()}
              onRelaunch={() => void handleTerminalRelaunch()}
            />
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
