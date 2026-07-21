import { BrowserWindow, app, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

export function getAppIconPath(): string {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  if (app.isPackaged) {
    return join(process.resourcesPath, "icons", iconName);
  }
  return join(__dirname, "../../build", iconName);
}

export interface WindowSize {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export function baseWindowOptions(
  size: WindowSize,
): Electron.BrowserWindowConstructorOptions {
  return {
    width: size.width,
    height: size.height,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
    },
  };
}

export function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    const base = process.env["ELECTRON_RENDERER_URL"];
    void win.loadURL(hash ? `${base}#${hash}` : base);
    return;
  }
  void win.loadFile(
    join(__dirname, "../renderer/index.html"),
    hash ? { hash } : {},
  );
}

let settingsWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;

function focusOrRestore(win: BrowserWindow): void {
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

function createChildWindow(
  title: string,
  hash: string,
  size: WindowSize,
): BrowserWindow {
  const win = new BrowserWindow({ ...baseWindowOptions(size), title });

  win.on("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadRenderer(win, hash);
  return win;
}

export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    focusOrRestore(settingsWindow);
    return;
  }

  settingsWindow = createChildWindow("设置", "/settings", {
    width: 760,
    height: 580,
    minWidth: 560,
    minHeight: 420,
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

export function openHistoryWindow(): void {
  if (historyWindow && !historyWindow.isDestroyed()) {
    focusOrRestore(historyWindow);
    return;
  }

  historyWindow = createChildWindow("启动历史", "/history", {
    width: 640,
    height: 500,
    minWidth: 480,
    minHeight: 360,
  });
  historyWindow.on("closed", () => {
    historyWindow = null;
  });
}
