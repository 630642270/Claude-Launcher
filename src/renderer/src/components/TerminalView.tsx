import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  active: boolean
  fontSize: number
  scrollback: number
  focusRequested?: boolean
  onFocusHandled?: () => void
  onClose: () => void
  onRelaunch: () => void
}

interface ContextMenuState {
  x: number
  y: number
}

const TOAST_DURATION_MS = 2200

export function TerminalView({
  active,
  fontSize,
  scrollback,
  focusRequested,
  onFocusHandled,
  onClose,
  onRelaunch
}: TerminalViewProps): React.JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const lastSizeRef = useRef({ cols: 0, rows: 0 })
  const [toast, setToast] = useState('')
  const [exited, setExited] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchInfo, setMatchInfo] = useState<{ index: number; count: number } | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), TOAST_DURATION_MS)
  }, [])

  const copySelection = useCallback(async () => {
    const terminal = terminalRef.current
    if (!terminal?.hasSelection()) {
      showToast('请先用鼠标选中要复制的内容')
      return
    }

    try {
      await navigator.clipboard.writeText(terminal.getSelection())
      showToast('已复制到剪贴板')
    } catch {
      showToast('剪贴板访问被拒绝')
    }
  }, [showToast])

  const pasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      window.launcher.writeTerminal(text)
      showToast('已粘贴')
    } catch {
      showToast('剪贴板访问被拒绝')
    }
  }, [showToast])

  const selectAll = useCallback(() => {
    terminalRef.current?.selectAll()
    showToast('已全选，可点击复制')
  }, [showToast])

  const applyFit = useCallback((notifyPty: boolean) => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon) return

    fitAddon.fit()

    const { cols, rows } = terminal
    if (cols <= 0 || rows <= 0) return

    const last = lastSizeRef.current
    if (last.cols === cols && last.rows === rows) return

    lastSizeRef.current = { cols, rows }
    if (notifyPty) {
      window.launcher.resizeTerminal(cols, rows)
    }
  }, [])

  const runSearch = useCallback((query: string) => {
    const searchAddon = searchAddonRef.current
    if (!searchAddon || !query) return
    searchAddon.findNext(query)
  }, [])

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      scrollback,
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "Microsoft YaHei", monospace',
      fontSize,
      theme: {
        background: '#0b0d12',
        foreground: '#e5e7eb',
        cursor: '#f43f5e',
        selectionBackground: '#3b4252',
        selectionForeground: '#ffffff'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)
    terminal.open(containerRef.current)

    terminal.onData((data) => {
      window.launcher.writeTerminal(data)
    })

    terminal.attachCustomKeyEventHandler((event) => {
      const key = event.key.toLowerCase()

      if (event.ctrlKey && key === 'f') {
        setSearchOpen(true)
        return false
      }

      if (event.ctrlKey && event.shiftKey && key === 'c') {
        void copySelection()
        return false
      }

      if (event.ctrlKey && event.shiftKey && key === 'v') {
        void pasteClipboard()
        return false
      }

      if (event.ctrlKey && key === 'c' && terminal.hasSelection()) {
        void copySelection()
        return false
      }

      if (event.ctrlKey && key === 'a') {
        terminal.selectAll()
        return false
      }

      return true
    })

    const unsubscribeData = window.launcher.onTerminalData((data) => {
      terminal.write(data)
    })

    const unsubscribeExit = window.launcher.onTerminalExit(() => {
      setExited(true)
      terminal.writeln('\r\n\x1b[33m[Claude Code 已退出]\x1b[0m')
    })

    const resultsDisposable = searchAddon.onDidChangeResults((results) => {
      if (!results) {
        setMatchInfo(null)
        return
      }
      setMatchInfo({ index: results.resultIndex, count: results.resultCount })
    })

    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY })
    }

    containerRef.current.addEventListener('contextmenu', handleContextMenu)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    window.requestAnimationFrame(() => applyFit(false))

    let resizeTimer: number | undefined
    const resizeTarget = shellRef.current ?? containerRef.current

    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => applyFit(true), 120)
    })

    resizeObserver.observe(resizeTarget)

    return () => {
      unsubscribeData()
      unsubscribeExit()
      resultsDisposable.dispose()
      window.clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      searchAddonRef.current = null
      lastSizeRef.current = { cols: 0, rows: 0 }
    }
  }, [applyFit, copySelection, pasteClipboard, fontSize, scrollback])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => applyFit(true), 80)
    return () => window.clearTimeout(timer)
  }, [active, applyFit])

  useEffect(() => {
    const unsubscribeLaunched = window.launcher.onTerminalLaunched((result) => {
      if (result.mode === 'embedded') {
        setExited(false)
        terminalRef.current?.clear()
      }
    })
    const unsubscribeSession = window.launcher.onTerminalSession((state) => {
      if (!state.active) {
        setExited(true)
      }
    })
    return () => {
      unsubscribeLaunched()
      unsubscribeSession()
    }
  }, [])

  useEffect(() => {
    if (!focusRequested || !active) return
    const timer = window.requestAnimationFrame(() => {
      terminalRef.current?.focus()
      onFocusHandled?.()
    })
    return () => window.cancelAnimationFrame(timer)
  }, [focusRequested, active, onFocusHandled])

  useEffect(() => {
    if (!contextMenu) return

    const closeMenu = (): void => setContextMenu(null)
    window.setTimeout(() => document.addEventListener('click', closeMenu), 0)
    return () => document.removeEventListener('click', closeMenu)
  }, [contextMenu])

  useEffect(() => {
    if (!searchOpen) return
    runSearch(searchQuery)
  }, [searchOpen, searchQuery, runSearch])

  const handleRelaunch = (): void => {
    terminalRef.current?.clear()
    setExited(false)
    onRelaunch()
  }

  return (
    <div ref={shellRef} className="terminal-shell">
      <div className="terminal-header">
        <span className="terminal-title">
          <span className="terminal-status-dot" aria-hidden="true" />
          内嵌终端
          {exited && (
            <span className="terminal-exited-badge">已退出</span>
          )}
        </span>
        <div className="terminal-toolbar">
          {exited && (
            <>
              <button type="button" className="btn btn-primary terminal-toolbar-btn" onClick={handleRelaunch}>
                重新启动
              </button>
              <button type="button" className="btn btn-secondary terminal-toolbar-btn" onClick={onClose}>
                关闭终端
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary terminal-toolbar-btn" onClick={copySelection}>
            复制
          </button>
          <button type="button" className="btn btn-secondary terminal-toolbar-btn" onClick={pasteClipboard}>
            粘贴
          </button>
          <button type="button" className="btn btn-secondary terminal-toolbar-btn" onClick={selectAll}>
            全选
          </button>
          <button
            type="button"
            className="btn btn-secondary terminal-toolbar-btn"
            onClick={() => setSearchOpen((open) => !open)}
          >
            搜索
          </button>
          <span className="terminal-hint">Ctrl+Shift+C / Ctrl+Shift+V / Ctrl+F</span>
        </div>
      </div>

      {searchOpen && (
        <div className="terminal-search-bar">
          <input
            className="field-input terminal-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false)
                setSearchQuery('')
                terminalRef.current?.focus()
              } else if (e.key === 'Enter') {
                e.preventDefault()
                searchAddonRef.current?.findNext(searchQuery)
              }
            }}
            placeholder="搜索终端输出..."
            autoFocus
          />
          <span className="terminal-search-count" aria-live="polite">
            {!searchQuery
              ? ''
              : matchInfo && matchInfo.count > 0
                ? `${matchInfo.index + 1} / ${matchInfo.count}`
                : '无匹配'}
          </span>
          <button
            type="button"
            className="btn btn-secondary terminal-toolbar-btn"
            onClick={() => searchAddonRef.current?.findPrevious(searchQuery)}
          >
            上一个
          </button>
          <button
            type="button"
            className="btn btn-secondary terminal-toolbar-btn"
            onClick={() => searchAddonRef.current?.findNext(searchQuery)}
          >
            下一个
          </button>
          <button
            type="button"
            className="btn btn-secondary terminal-toolbar-btn"
            onClick={() => {
              setSearchOpen(false)
              setSearchQuery('')
            }}
          >
            关闭
          </button>
        </div>
      )}

      <div ref={containerRef} className="terminal-body" />

      {contextMenu && (
        <div
          className="terminal-context-menu"
          role="menu"
          aria-label="终端操作"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => { void copySelection(); setContextMenu(null) }}>
            复制
          </button>
          <button type="button" role="menuitem" onClick={() => { void pasteClipboard(); setContextMenu(null) }}>
            粘贴
          </button>
          <button type="button" role="menuitem" onClick={() => { void selectAll(); setContextMenu(null) }}>
            全选
          </button>
        </div>
      )}

      {toast && <div className="terminal-toast">{toast}</div>}
    </div>
  )
}
