import { app, BrowserWindow, shell } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { getConfig } from "./configStore";
import { registerIpcHandlers } from "./ipc/handlers";
import { killEmbeddedTerminal } from "./terminal/embedded";
import { createTray, destroyTray, setTrayQuitting } from "./tray";
import { baseWindowOptions, loadRenderer } from "./windows";

let mainWindow: BrowserWindow | null = null;
let appIsQuitting = false;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    ...baseWindowOptions({
      width: 900,
      height: 620,
      minWidth: 760,
      minHeight: 520,
    }),
    title: "Claude Launcher",
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    const config = getConfig();
    if (config.minimizeToTray && !appIsQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    killEmbeddedTerminal();
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  loadRenderer(mainWindow);

  return mainWindow;
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.claude.launcher");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  registerIpcHandlers(getMainWindow);
  createWindow();
  createTray(getMainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  appIsQuitting = true;
  setTrayQuitting(true);
  killEmbeddedTerminal();
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
