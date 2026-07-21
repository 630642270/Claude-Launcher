import { useCallback, useEffect, useState } from "react";
import type { ConfigView } from "@shared/types";
import { Home } from "./pages/Home";
import { Settings } from "./pages/Settings";
import { HistoryPage } from "./pages/History";
import { TerminalView } from "./components/TerminalView";
import { TitleBar } from "./components/TitleBar";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";

type Route = "main" | "settings" | "history";

function getRoute(): Route {
  const hash = window.location.hash;
  if (hash.startsWith("#/settings")) return "settings";
  if (hash.startsWith("#/history")) return "history";
  return "main";
}

function SettingsWindow(): React.JSX.Element {
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const handleClose = useCallback((): void => {
    if (dirty) {
      setConfirmDiscard(true);
    } else {
      void window.launcher.closeWindow();
    }
  }, [dirty]);

  return (
    <div className="app-shell app-shell-window">
      <TitleBar title="设置" onClose={handleClose} />
      <div className="window-body">
        <Settings onDirtyChange={setDirty} />
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        danger
        title="放弃未保存的更改？"
        message="当前窗口还有未保存的设置修改，直接关闭将放弃这些更改。"
        confirmLabel="放弃并关闭"
        onConfirm={() => void window.launcher.closeWindow()}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

function HistoryWindow(): React.JSX.Element {
  return (
    <div className="app-shell app-shell-window">
      <TitleBar title="启动历史" />
      <div className="window-body">
        <HistoryPage />
      </div>
    </div>
  );
}

function MainWindow(): React.JSX.Element {
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [focusTerminal, setFocusTerminal] = useState(false);

  const refreshConfig = useCallback(async (): Promise<void> => {
    const data = await window.launcher.getConfig();
    setConfig(data);
  }, []);

  useEffect(() => {
    void refreshConfig();
    window.launcher
      .getTerminalSession()
      .then((state) => setSessionActive(state.active));
  }, [refreshConfig]);

  useEffect(() => {
    const unsubscribeConfig = window.launcher.onConfigChanged(() => {
      void refreshConfig();
    });

    const unsubscribeLaunched = window.launcher.onTerminalLaunched((result) => {
      if (result.mode === "embedded") {
        setShowTerminal(true);
        setFocusTerminal(true);
      }
    });

    const unsubscribeSession = window.launcher.onTerminalSession((state) => {
      setSessionActive(state.active);
    });

    return () => {
      unsubscribeConfig();
      unsubscribeLaunched();
      unsubscribeSession();
    };
  }, [refreshConfig]);

  const handleTerminalClose = useCallback(async (): Promise<void> => {
    await window.launcher.killTerminal();
    setShowTerminal(false);
  }, []);

  const handleTerminalRelaunch = useCallback(async (): Promise<void> => {
    const freshConfig = await window.launcher.getConfig();
    if (!freshConfig.lastProjectPath) return;

    const terminalSize = await window.launcher.getTerminalSize();
    await window.launcher.launch({
      projectPath: freshConfig.lastProjectPath,
      mode: "embedded",
      terminalSize,
    });
  }, []);

  const handleKillSession = useCallback(async (): Promise<void> => {
    await window.launcher.killTerminal();
    setShowTerminal(false);
  }, []);

  return (
    <div className="app-shell app-shell-main">
      <TitleBar title="Claude Launcher" />

      <div className="app-toolbar">
        <nav className="toolbar-nav">
          <button
            type="button"
            className={`nav-link ${showTerminal ? "" : "nav-link-active"}`}
            aria-current={showTerminal ? undefined : "page"}
            onClick={() => setShowTerminal(false)}
          >
            启动
          </button>
          <button
            type="button"
            className="nav-link"
            onClick={() => void window.launcher.openSettingsWindow()}
          >
            设置
            <span className="nav-ext" aria-hidden="true">
              ↗
            </span>
          </button>
          <button
            type="button"
            className="nav-link"
            onClick={() => void window.launcher.openHistoryWindow()}
          >
            历史
            <span className="nav-ext" aria-hidden="true">
              ↗
            </span>
          </button>
        </nav>
        {sessionActive && (
          <span className="session-indicator">
            <span className="session-dot" aria-hidden="true" />
            内嵌会话运行中
            <button
              type="button"
              className="session-kill-btn"
              onClick={() => void handleKillSession()}
            >
              终止
            </button>
          </span>
        )}
      </div>

      <main className="app-main">
        <div className={`home-slot ${showTerminal ? "home-slot-hidden" : ""}`}>
          <Home
            config={config}
            onConfigChange={setConfig}
            onTerminalShow={setShowTerminal}
          />
        </div>

        <div
          className={`terminal-panel ${showTerminal ? "terminal-panel-visible" : "terminal-panel-hidden"}`}
        >
          <section className="card terminal-card">
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
  );
}

function App(): React.JSX.Element {
  const route = getRoute();
  if (route === "settings") return <SettingsWindow />;
  if (route === "history") return <HistoryWindow />;
  return <MainWindow />;
}

export default App;
