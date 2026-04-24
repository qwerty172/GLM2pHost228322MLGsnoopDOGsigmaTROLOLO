import { app, BrowserWindow, desktopCapturer, dialog, ipcMain } from "electron";
import path from "node:path";
import { loadConfig, saveConfig } from "./config";
import { createTray, setStatus } from "./tray";
import { initInputInjector, injectInput } from "./input-injection";
import { launchApp, killApp } from "./app-launcher";
import { log } from "./logger";
import type { AgentStatus, HostConfig, InputEvent } from "../shared/messages";

let mainWindow: BrowserWindow | null = null;

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 760,
    height: 640,
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      // dist layout: dist/main/main/index.js  +  dist/main/preload/index.js
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  // dist layout:
  //   dist/main/main/index.js       <- this file (__dirname = dist/main/main)
  //   dist/main/preload/index.js
  //   dist/renderer/index.html
  mainWindow.loadFile(
    path.join(__dirname, "..", "..", "renderer", "index.html"),
  );
  mainWindow.on("close", (e) => {
    // Hide to tray instead of quitting on window close.
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function applyAutoLaunch(config: HostConfig): void {
  if (process.platform !== "win32") return;
  app.setLoginItemSettings({
    openAtLogin: !!config.autoLaunchAtStartup,
    path: process.execPath,
    args: ["--hidden"],
  });
}

void app.whenReady().then(async () => {
  initInputInjector();
  const config = await loadConfig();
  applyAutoLaunch(config);

  createTray(() => {
    createWindow();
  });

  // Don't show the window automatically when launched at startup with --hidden.
  if (!process.argv.includes("--hidden")) {
    createWindow();
  }

  ipcMain.handle("config:get", async () => {
    return loadConfig();
  });

  ipcMain.handle("config:set", async (_e, next: HostConfig) => {
    const saved = await saveConfig(next);
    applyAutoLaunch(saved);
    return saved;
  });

  ipcMain.on("status:set", (_e, status: AgentStatus, message?: string) => {
    setStatus(status, message);
  });

  ipcMain.on("input:inject", (_e, event: InputEvent) => {
    injectInput(event);
  });

  ipcMain.handle(
    "capture:get-sources",
    async (): Promise<{ id: string; name: string }[]> => {
      // Surface Electron's desktopCapturer to the sandboxed renderer through
      // a preload bridge. The renderer cannot access it directly because
      // contextIsolation is enabled and nodeIntegration is disabled.
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 0, height: 0 },
      });
      return sources.map((s) => ({ id: s.id, name: s.name }));
    },
  );

  ipcMain.handle("app:launch", async () => {
    const cfg = await loadConfig();
    return launchApp(cfg);
  });

  ipcMain.on("app:kill", () => killApp());

  ipcMain.handle("dialog:open-file", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Select executable",
      filters: [
        { name: "Executables", extensions: ["exe"] },
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.on(
    "log",
    (_e, level: "info" | "warn" | "error", message: string) => {
      log(level, `[renderer] ${message}`);
    },
  );

  setStatus("idle");
  log("info", "Host agent ready.");
});

app.on("second-instance", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  // Keep the agent running in the tray on Windows even when no window exists;
  // do nothing here so the app stays alive.
});

app.on("before-quit", () => {
  (app as unknown as { isQuitting?: boolean }).isQuitting = true;
  killApp();
});
