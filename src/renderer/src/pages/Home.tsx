import { useEffect, useRef, useState } from "react";
import type {
  AppConfig,
  ConfigView,
  ClaudeDetectionResult,
  EnvPair,
  ProfileView,
} from "@shared/types";
import { formatTerminalMode } from "@shared/types";
import { EnvEditor } from "../components/EnvEditor";
import { ProfileList } from "../components/ProfileList";
import { ModelSelect } from "../components/ModelSelect";
import { Select } from "../components/Select";
import type { SelectOption } from "../components/Select";
import { Toggle } from "../components/ui/Toggle";
import { Field } from "../components/ui/Field";

const TERMINAL_MODE_OPTIONS: SelectOption[] = [
  { value: "embedded", label: "内嵌终端" },
  { value: "external", label: "外部终端" },
  { value: "ask", label: "每次启动询问" },
];

const EXTERNAL_TERMINAL_OPTIONS: SelectOption[] = [
  { value: "wt", label: "Windows Terminal" },
  { value: "powershell", label: "PowerShell" },
  { value: "cmd", label: "CMD" },
];

function resolveLaunchModel(
  profile: ProfileView | undefined,
  config: ConfigView,
): string {
  if (profile?.lastLaunchModel) return profile.lastLaunchModel;
  if (config.models.main) return config.models.main;
  return config.availableModels[0]?.id ?? "";
}

interface HomeProps {
  config: ConfigView | null;
  onConfigChange: (config: ConfigView) => void;
  onTerminalShow: (show: boolean) => void;
}

export function Home({
  config,
  onConfigChange,
  onTerminalShow,
}: HomeProps): React.JSX.Element {
  const [projectPath, setProjectPath] = useState("");
  const [detection, setDetection] = useState<ClaudeDetectionResult | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [askMode, setAskMode] = useState(false);
  const [launchModel, setLaunchModel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [claudePathInput, setClaudePathInput] = useState("");
  const envDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (config?.claudePath !== undefined) {
      setClaudePathInput(config.claudePath);
    }
  }, [config?.claudePath]);

  useEffect(() => {
    if (config?.lastProjectPath) {
      setProjectPath(config.lastProjectPath);
    }
  }, [config?.lastProjectPath]);

  useEffect(() => {
    window.launcher.detectClaude().then(setDetection);
  }, [config?.claudePath]);

  useEffect(() => {
    const unsubscribe = window.launcher.onAppError((msg) => setError(msg));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!config) {
      setLaunchModel("");
      return;
    }

    const profile = config.profiles.find(
      (item) => item.id === config.activeProfileId,
    );
    setLaunchModel(resolveLaunchModel(profile, config));
  }, [
    config?.activeProfileId,
    config?.models.main,
    config?.availableModels,
    config?.profiles,
  ]);

  const pickDirectory = async (): Promise<void> => {
    const selected = await window.launcher.pickDirectory();
    if (selected) setProjectPath(selected);
  };

  const switchProfile = async (profileId: string): Promise<void> => {
    if (!config || profileId === config.activeProfileId) return;
    const updated = await window.launcher.switchProfile(profileId);
    onConfigChange(updated);
  };

  const activeProfile = config?.profiles.find(
    (profile) => profile.id === config.activeProfileId,
  );

  const saveGlobal = async (
    partial: Partial<AppConfig>,
  ): Promise<void> => {
    const updated = await window.launcher.saveConfig(partial);
    onConfigChange(updated);
  };

  const saveEnvDebounced = (customEnv: EnvPair[]): void => {
    if (envDebounceRef.current) clearTimeout(envDebounceRef.current);
    envDebounceRef.current = setTimeout(() => {
      void saveGlobal({ customEnv });
    }, 600);
  };

  const launch = async (mode?: "embedded" | "external"): Promise<void> => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const freshConfig = await window.launcher.getConfig();

      if (!freshConfig.apiKeyMasked) {
        setError("请先在设置中配置 API Key，已为你打开设置窗口");
        void window.launcher.openSettingsWindow();
        return;
      }

      const resolvedMode =
        mode ??
        (freshConfig.terminalMode === "ask"
          ? undefined
          : freshConfig.terminalMode);

      if (resolvedMode === "embedded") {
        onTerminalShow(true);
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      } else if (resolvedMode === "external") {
        onTerminalShow(false);
        await window.launcher.killTerminal();
      }

      const terminalSize =
        resolvedMode === "embedded"
          ? await window.launcher.getTerminalSize()
          : undefined;
      const result = await window.launcher.launch({
        projectPath,
        mode,
        terminalSize,
        ...(launchModel.trim() ? { model: launchModel.trim() } : {}),
      });

      if (result.mode === "embedded") {
        onTerminalShow(true);
        setMessage("已在内嵌终端启动 Claude Code（兼容 API 环境已隔离注入）");
      } else {
        onTerminalShow(false);
        if (result.fallback && result.message) {
          setMessage(result.message);
        } else {
          setMessage(
            "已在外部终端启动 Claude Code，请查看新弹出的终端窗口（兼容 API 环境已隔离注入）",
          );
        }
      }
      const updated = await window.launcher.getConfig();
      onConfigChange(updated);
      setAskMode(false);
    } catch (err) {
      const text = String(err);
      if (text.includes("ASK_MODE")) {
        setAskMode(true);
      } else {
        setError(text.replace("Error: ", ""));
      }
    } finally {
      setLoading(false);
    }
  };

  const resolvedModelLabel = launchModel || config?.models.main || "未设置";

  return (
    <div className="home-grid">
      <section className="card home-launch">
        <h2 className="section-title">启动 Claude Code</h2>

        <label
          className={`home-field ${dragOver ? "drag-over" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files[0];
            if (!file) return;
            const path = window.launcher.getPathForFile(file);
            if (path) setProjectPath(path);
          }}
        >
          <span className="field-label">项目目录</span>
          <div className="row">
            <input
              className="field-input"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && projectPath.trim() && !loading) {
                  void launch();
                }
              }}
              placeholder="选择或输入项目路径，也可直接拖入文件夹"
            />
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={() => void pickDirectory()}
            >
              浏览
            </button>
          </div>
        </label>

        <div className="home-field home-profiles">
          <span className="field-label">配置档案</span>
          <ProfileList
            compact
            profiles={config?.profiles ?? []}
            activeProfileId={config?.activeProfileId ?? ""}
            onSelect={(profileId) => void switchProfile(profileId)}
          />
        </div>

        <div className="home-field">
          <ModelSelect
            label="启动模型"
            value={launchModel}
            options={config?.availableModels ?? []}
            onChange={setLaunchModel}
          />
        </div>

        <div className="home-actions">
          {askMode ? (
            <>
              <button
                type="button"
                className="btn btn-primary home-launch-btn"
                disabled={loading || !projectPath}
                onClick={() => void launch("embedded")}
              >
                内嵌终端启动
              </button>
              <button
                type="button"
                className="btn btn-secondary home-launch-btn"
                disabled={loading || !projectPath}
                onClick={() => void launch("external")}
              >
                外部终端启动
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary home-launch-btn"
              disabled={loading || !projectPath}
              onClick={() => void launch()}
            >
              {loading ? "启动中..." : "启动 Claude Code"}
            </button>
          )}
        </div>

        <p
          className={`home-message ${
            error ? "text-error-msg" : message ? "text-success-msg" : ""
          }`}
        >
          {error || message || " "}
        </p>
      </section>

      <aside className="home-side">
        <section className="card home-status">
          <h2 className="section-title">状态</h2>
          <div className="status-row">
            <span className="status-key">
              <span
                className={`status-dot ${detection?.found ? "dot-ok" : "dot-warn"}`}
                aria-hidden="true"
              />
              Claude 检测
            </span>
            <span
              className={`status-value ${detection?.found ? "text-success" : "text-warning"}`}
            >
              {detection?.found ? "已找到" : "未检测到"}
            </span>
          </div>
          <div className="status-row">
            <span className="status-key">
              <span
                className={`status-dot ${config?.apiKeyMasked ? "dot-ok" : "dot-warn"}`}
                aria-hidden="true"
              />
              当前档案
            </span>
            <span
              className={`status-value ${config?.apiKeyMasked ? "" : "text-warning"}`}
            >
              {activeProfile?.name ?? "未配置"}
            </span>
          </div>
          <div className="status-row">
            <span className="status-key">终端模式</span>
            <span className="status-value">
              {formatTerminalMode(config?.terminalMode)}
            </span>
          </div>
          <div className="status-row">
            <span className="status-key">启动模型</span>
            <span className="status-value" title={resolvedModelLabel}>
              {resolvedModelLabel}
            </span>
          </div>
          {detection?.found && (
            <p className="status-detail" title={detection.path}>
              {detection.path}
            </p>
          )}
          {config?.apiKeyMasked && (
            <p className="status-detail">{config.apiKeyMasked}</p>
          )}
        </section>

        <section className="card home-options">
          <h2 className="section-title">启动选项</h2>

          <Select
            label="终端模式"
            value={config?.terminalMode ?? "embedded"}
            options={TERMINAL_MODE_OPTIONS}
            onChange={(terminalMode) =>
              void saveGlobal({
                terminalMode: terminalMode as AppConfig["terminalMode"],
              })
            }
          />

          <div className="grid-2">
            <Field label="字体大小">
              <input
                className="field-input"
                type="number"
                min={10}
                max={24}
                value={config?.terminalFontSize ?? 14}
                onChange={(e) =>
                  void saveGlobal({
                    terminalFontSize: Number(e.target.value) || 14,
                  })
                }
              />
            </Field>
            <Field label="滚动缓冲">
              <input
                className="field-input"
                type="number"
                min={500}
                max={10000}
                step={500}
                value={config?.terminalScrollback ?? 2000}
                onChange={(e) =>
                  void saveGlobal({
                    terminalScrollback: Number(e.target.value) || 2000,
                  })
                }
              />
            </Field>
          </div>

          <Select
            label="外部终端"
            value={config?.externalTerminal ?? "wt"}
            options={EXTERNAL_TERMINAL_OPTIONS}
            onChange={(externalTerminal) =>
              void saveGlobal({
                externalTerminal:
                  externalTerminal as AppConfig["externalTerminal"],
              })
            }
          />

          <Field label="Claude 路径（可选）">
            <div className="row">
              <input
                className="field-input"
                value={claudePathInput}
                onChange={(e) => setClaudePathInput(e.target.value)}
                onBlur={() =>
                  void saveGlobal({ claudePath: claudePathInput })
                }
                placeholder="留空自动检测"
              />
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                onClick={async () => {
                  const selected =
                    await window.launcher.pickExecutable();
                  if (selected) {
                    setClaudePathInput(selected);
                    void saveGlobal({ claudePath: selected });
                  }
                }}
              >
                浏览
              </button>
            </div>
          </Field>

          <div className="stack">
            <Toggle
              checked={config?.minimizeToTray ?? true}
              onChange={(v) => void saveGlobal({ minimizeToTray: v })}
              label="最小化到托盘"
            />
            <Toggle
              checked={config?.disableNonessentialTraffic ?? true}
              onChange={(v) =>
                void saveGlobal({ disableNonessentialTraffic: v })
              }
              label="禁用非必要流量"
            />
            <Toggle
              checked={config?.dangerouslySkipPermissions ?? false}
              onChange={(v) =>
                void saveGlobal({ dangerouslySkipPermissions: v })
              }
              label="跳过权限确认"
            />
          </div>
        </section>

        <section className="card home-options">
          <EnvEditor
            value={config?.customEnv ?? []}
            onChange={saveEnvDebounced}
          />
        </section>

        <p className="home-hint">
          环境变量仅注入到 Claude Code 子进程，不会修改系统全局环境。
        </p>
      </aside>
    </div>
  );
}
