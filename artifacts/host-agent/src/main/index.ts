import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import { loadConfig, saveConfig } from "./config";
import { createTray, setStatus } from "./tray";
import { initInputInjector, injectInput } from "./input-injection";
import { launchApp, launchEntry, killApp, setExitCallback } from "./app-launcher";
import { fetchLibrary, patchLocalAvailability } from "./api-client";
import { scanSteam, loadScanState, saveScanState } from "./steam-scanner";
import { log } from "./logger";
import type { AgentStatus, HostConfig, InputEvent, GameEntryLaunch, LibraryEntry, SteamScanResult } from "../shared/messages";

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
    height: 820,
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
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 0, height: 0 },
      });
      return sources.map((s) => ({ id: s.id, name: s.name }));
    },
  );

  // Legacy launch: uses HostConfig.appPath / boundUrl / appArgs from config file.
  ipcMain.handle("app:launch", async () => {
    const cfg = await loadConfig();
    setExitCallback(() => {
      mainWindow?.webContents.send("app:game-exited");
    });
    return launchApp(cfg);
  });

  // Library-based launch: renderer passes the specific entry to launch.
  // On exit the main process sends "app:game-exited" to the renderer so the
  // active session can be ended automatically and billing stopped.
  ipcMain.handle("app:launch-entry", async (_e, entry: GameEntryLaunch) => {
    setExitCallback(() => {
      mainWindow?.webContents.send("app:game-exited");
    });
    return launchEntry(entry);
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

  // Library fetch: fetches from server, runs local path validation, reports
  // back to server, and returns the entries to the renderer for display.
  ipcMain.handle(
    "library:fetch",
    async (
      _e,
      hostToken: string,
      apiBaseUrl: string,
    ): Promise<LibraryEntry[]> => {
      const entries = await fetchLibrary(hostToken, apiBaseUrl);
      if (!entries) return [];

      // Validate local paths for native-exe games.
      for (const entry of entries) {
        if (!entry.enabled) continue;
        const appPath = entry.appPath.trim();
        if (!appPath) continue; // browser game — no local file to check

        let available = true;
        let lastError = "";
        try {
          await fs.access(appPath);
        } catch {
          available = false;
          lastError = "file_not_found";
        }

        // Only PATCH when the status changed to avoid unnecessary API calls.
        if (available !== entry.localAvailable || (lastError && lastError !== entry.lastError)) {
          await patchLocalAvailability(hostToken, apiBaseUrl, entry.gameId, available, lastError);
          entry.localAvailable = available;
          entry.lastError = lastError;
        }
      }

      return entries;
    },
  );

  // Patch a single library entry's local availability status.
  ipcMain.handle(
    "library:patch-availability",
    async (
      _e,
      hostToken: string,
      apiBaseUrl: string,
      gameId: string,
      localAvailable: boolean,
      lastError?: string,
    ): Promise<void> => {
      await patchLocalAvailability(hostToken, apiBaseUrl, gameId, localAvailable, lastError);
    },
  );

  // Open the directory containing the given file path in Windows Explorer.
  ipcMain.on("library:open-explorer", (_e, filePath: string) => {
    void shell.showItemInFolder(filePath);
  });

  // ── Steam library scan ────────────────────────────────────────────────────
  // Scans the local Steam installation, matches against the platform catalog
  // (fetched from apiBaseUrl), and annotates each result with:
  //   - catalogGame: matched platform game (by steamAppId) or null
  //   - alreadyInLibrary: true when the host already has this game
  // Also updates scan state on disk to enable delta re-scans.
  ipcMain.handle(
    "steam:scan",
    async (_e, hostToken: string, apiBaseUrl: string): Promise<SteamScanResult> => {
      const { games: steamGames, steamRoot, error } = await scanSteam();
      if (error && steamGames.length === 0) {
        return { steamRoot, games: [], error };
      }

      // Fetch catalog games to match by steamAppId.
      // Use /api/public/games — it includes the steamAppId field in its response
      // unlike /api/games which omits it from the select list.
      let catalogGames: Array<{
        id: string;
        title: string;
        slug: string;
        steamAppId: string | null;
        coverImageUrl: string;
      }> = [];
      try {
        const base = apiBaseUrl.replace(/\/$/, "");
        const resp = await fetch(`${base}/api/public/games`);
        if (resp.ok) {
          catalogGames = (await resp.json()) as typeof catalogGames;
          log("info", `[steam-scan] Catalog: ${catalogGames.length} games, ${catalogGames.filter(g => g.steamAppId).length} with steamAppId`);
        } else {
          log("warn", `[steam-scan] Catalog fetch returned ${resp.status}`);
        }
      } catch (err) {
        log("warn", `[steam-scan] Could not fetch catalog: ${String(err)}`);
      }

      // Build lookup map by steamAppId.
      const catalogByAppId = new Map<
        string,
        { id: string; title: string; slug: string; coverImageUrl: string }
      >();
      for (const g of catalogGames) {
        if (g.steamAppId) catalogByAppId.set(g.steamAppId, g);
      }

      // Fetch current library to mark already-added games.
      const libraryEntries = (await fetchLibrary(hostToken, apiBaseUrl)) ?? [];
      const libraryGameIds = new Set(libraryEntries.map((e) => e.gameId));

      // Load persisted scan state.
      const scanState = await loadScanState();
      const addedAppIds = new Set(scanState.addedAppIds);

      const enriched = steamGames.map((sg) => {
        const catalogGame = catalogByAppId.get(sg.appId) ?? null;
        const alreadyInLibrary =
          addedAppIds.has(sg.appId) ||
          (catalogGame !== null && libraryGameIds.has(catalogGame.id));
        return {
          appId: sg.appId,
          name: sg.name,
          installDir: sg.installDir,
          fullInstallPath: sg.fullInstallPath,
          bestExePath: sg.bestExePath,
          catalogGame,
          alreadyInLibrary,
        };
      });

      // Persist last-scan timestamp.
      await saveScanState({
        addedAppIds: scanState.addedAppIds,
        lastScanAt: new Date().toISOString(),
      });

      return { steamRoot, games: enriched, error };
    },
  );

  // Mark a set of steamAppIds as added (called after bulk-add succeeds).
  ipcMain.handle(
    "steam:mark-added",
    async (_e, appIds: string[]): Promise<void> => {
      const state = await loadScanState();
      const merged = Array.from(new Set([...state.addedAppIds, ...appIds]));
      await saveScanState({ ...state, addedAppIds: merged });
    },
  );

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
