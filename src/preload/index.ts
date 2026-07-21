import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  AppConfig,
  BenchmarkResult,
  ConfigView,
  ConnectionTestResult,
  LaunchOptions,
  LaunchRecord,
  ClaudeDetectionResult,
  ProfileSaveRequest,
  ProviderRequest,
} from "../shared/types";

export interface LaunchResult {
  mode: "embedded" | "external";
  fallback?: boolean;
  message?: string;
}

export interface TerminalSessionState {
  active: boolean;
}

export interface LauncherAPI {
  getConfig(): Promise<ConfigView>;
  saveConfig(config: Partial<AppConfig>): Promise<ConfigView>;
  revealApiKey(profileId: string): Promise<string>;
  switchProfile(profileId: string): Promise<ConfigView>;
  saveProfile(
    request: ProfileSaveRequest,
  ): Promise<ConfigView & { fetchError?: string }>;
  createProfile(name?: string): Promise<ConfigView>;
  duplicateProfile(profileId: string): Promise<ConfigView>;
  deleteProfile(profileId: string): Promise<ConfigView>;
  testConnection(request?: ProviderRequest): Promise<ConnectionTestResult>;
  benchmark(request?: ProviderRequest): Promise<BenchmarkResult>;
  fetchModels(request?: ProviderRequest): Promise<ConfigView>;
  pickDirectory(): Promise<string | null>;
  pickExecutable(): Promise<string | null>;
  getPathForFile(file: File): string;
  detectClaude(): Promise<ClaudeDetectionResult>;
  launch(options: LaunchOptions): Promise<LaunchResult>;
  isEmbeddedTerminalAvailable(): Promise<boolean>;
  getTerminalSize(): Promise<{ cols: number; rows: number }>;
  getTerminalSession(): Promise<TerminalSessionState>;
  getHistory(): Promise<LaunchRecord[]>;
  clearHistory(): Promise<LaunchRecord[]>;
  openPath(path: string): Promise<string>;
  killTerminal(): Promise<void>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  openSettingsWindow(): Promise<void>;
  openHistoryWindow(): Promise<void>;
  onConfigChanged(callback: () => void): () => void;
  onTerminalData(callback: (data: string) => void): () => void;
  onTerminalExit(callback: () => void): () => void;
  onTerminalLaunched(callback: (result: LaunchResult) => void): () => void;
  onTerminalSession(
    callback: (state: TerminalSessionState) => void,
  ): () => void;
  onAppError(callback: (message: string) => void): () => void;
  writeTerminal(data: string): void;
  resizeTerminal(cols: number, rows: number): void;
}

declare global {
  interface Window {
    launcher: LauncherAPI;
  }
}

const launcher: LauncherAPI = {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (config) => ipcRenderer.invoke("config:save", config),
  revealApiKey: (profileId) =>
    ipcRenderer.invoke("profile:revealApiKey", profileId),
  switchProfile: (profileId) => ipcRenderer.invoke("profile:switch", profileId),
  saveProfile: (request) => ipcRenderer.invoke("profile:save", request),
  createProfile: (name) => ipcRenderer.invoke("profile:create", name),
  duplicateProfile: (profileId) =>
    ipcRenderer.invoke("profile:duplicate", profileId),
  deleteProfile: (profileId) => ipcRenderer.invoke("profile:delete", profileId),
  testConnection: (request) =>
    ipcRenderer.invoke("provider:testConnection", request),
  benchmark: (request) => ipcRenderer.invoke("provider:benchmark", request),
  fetchModels: (request) => ipcRenderer.invoke("provider:fetchModels", request),
  pickDirectory: () => ipcRenderer.invoke("dialog:pickDirectory"),
  pickExecutable: () => ipcRenderer.invoke("dialog:pickExecutable"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  detectClaude: () => ipcRenderer.invoke("claude:detect"),
  launch: (options) => ipcRenderer.invoke("launch", options),
  isEmbeddedTerminalAvailable: () => ipcRenderer.invoke("terminal:available"),
  getTerminalSize: () => ipcRenderer.invoke("terminal:size"),
  getTerminalSession: () => ipcRenderer.invoke("terminal:session"),
  getHistory: () => ipcRenderer.invoke("history:get"),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  openPath: (path) => ipcRenderer.invoke("shell:openPath", path),
  killTerminal: () => ipcRenderer.invoke("terminal:kill"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  openSettingsWindow: () => ipcRenderer.invoke("window:openSettings"),
  openHistoryWindow: () => ipcRenderer.invoke("window:openHistory"),
  onConfigChanged: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on("config:changed", listener);
    return () => ipcRenderer.removeListener("config:changed", listener);
  },
  onTerminalData: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: string): void =>
      callback(data);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onTerminalExit: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  },
  onTerminalLaunched: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      result: LaunchResult,
    ): void => callback(result);
    ipcRenderer.on("terminal:launched", listener);
    return () => ipcRenderer.removeListener("terminal:launched", listener);
  },
  onTerminalSession: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: TerminalSessionState,
    ): void => callback(state);
    ipcRenderer.on("terminal:session", listener);
    return () => ipcRenderer.removeListener("terminal:session", listener);
  },
  onAppError: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      message: string,
    ): void => callback(message);
    ipcRenderer.on("app:error", listener);
    return () => ipcRenderer.removeListener("app:error", listener);
  },
  writeTerminal: (data) => ipcRenderer.send("terminal:write", data),
  resizeTerminal: (cols, rows) =>
    ipcRenderer.send("terminal:resize", cols, rows),
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("launcher", launcher);
} else {
  window.launcher = launcher;
}
