import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, Notification, shell } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { initSentryMain } from "./sentry";
import { promises as fs } from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";
import type http from "node:http";
import { loadConfig, saveConfig, getCachedConfig } from "./config";
import { createTray, setStatus } from "./tray";
import { initInputInjector, injectInput, getInjectorStatus } from "./input-injection";
import {
  initGamepadInjector,
  injectGamepad,
  connectGamepad,
  disconnectGamepad,
  destroyGamepadInjector,
  getGamepadInjectorStatus,
} from "./gamepad-injection";
import {
  startRtmpRelay,
  stopRtmpRelay,
  syncRtmpWindowTitle,
  fetchStreamRelayConfig,
} from "./rtmp-relay";
import { createPingServer, PING_PORT, PING_PORT_FALLBACKS, LOCAL_INPUT_SECRET } from "./ping-server";
import { launchApp, launchEntry, killApp, setExitCallback, getLaunchedGamePid } from "./app-launcher";
import { matchSpawnedCaptureSource } from "./spawn-window-match";
import {
  clearAllowedTarget,
  getFocusGuardStatus,
  setAllowedTarget,
  setInputBlocked,
} from "./focus-guard";
import { fetchLibrary, fetchHostSchedule, patchLocalAvailability, sendHeartbeat } from "./api-client";
import { syncWakeTasks } from "./wake-scheduler";
import { pullSave, pushSave, restoreSave, backupSave, type SaveManifestEntry } from "./save-sync";
import { scanSteam, loadScanState, saveScanState } from "./steam-scanner";
import { loadOrGenerateKeyPair, signChallenge } from "./crypto-key";
import { log } from "./logger";
import { parseInputEvent, parseGamepadState } from "../shared/input";
import type { AgentStatus, HostConfig, InputEvent, GameEntryLaunch, LibraryEntry, SteamScanResult, QuotaStatusEvent, SaveSyncRequest, SaveSyncResult } from "../shared/messages";

let mainWindow: BrowserWindow | null = null;
let pingServer: http.Server | null = null;
let pingPortInUse = PING_PORT;
/** Window title currently captured by WebRTC — used to sync RTMP gdigrab. */
let currentCaptureTitle = "";
const lifetimeIntervals: ReturnType<typeof setInterval>[] = [];

function trackInterval(handle: ReturnType<typeof setInterval>): void {
  lifetimeIntervals.push(handle);
}

function isHostConfig(raw: unknown): raw is HostConfig {
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return typeof o["hostToken"] === "string" && typeof o["apiBaseUrl"] === "string";
}

function isGameEntryLaunch(raw: unknown): raw is GameEntryLaunch {
  if (typeof raw !== "object" || raw === null) return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o["appPath"] === "string" &&
    typeof o["boundUrl"] === "string" &&
    typeof o["launchArgs"] === "string"
  );
}

function allowedCorsOriginsFromConfig(cfg: HostConfig | null): string[] {
  const out: string[] = [];
  const base = cfg?.apiBaseUrl?.trim();
  if (base) {
    try {
      out.push(new URL(base).origin);
    } catch {
      /* ignore */
    }
  }
  return out;
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
}

// ── Startup diagnostics ──────────────────────────────────────────────────────
// The agent must never die silently: any unhandled error is shown in a
// human-readable dialog with a hint about what to do, and written to the log.

function showFatalError(title: string, details: string): void {
  log("error", `[fatal] ${title}: ${details}`);
  try {
    dialog.showErrorBox(
      title,
      `${details}\n\nЧто делать:\n` +
        "1. Закрой агент и запусти start.bat заново.\n" +
        "2. Если не помогло — удали папку node_modules и запусти start.bat " +
        "(зависимости переустановятся автоматически).\n" +
        "3. Проверь, что установлен Node.js 20+ (node --version).\n" +
        "4. Лог ошибок: logs\\agent.log (в папке, куда распакован ZIP)",
    );
  } catch {
    // dialog unavailable (app not ready) — the log line above is the trace.
  }
}

process.on("uncaughtException", (err) => {
  showFatalError(
    "Агент столкнулся с ошибкой",
    `Непредвиденная ошибка: ${err?.stack ?? String(err)}`,
  );
});

process.on("unhandledRejection", (reason) => {
  log("error", `[fatal] Unhandled rejection: ${String(reason)}`);
});

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
      sandbox: true,
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

function applyAutoLaunch(config: HostConfig, forceOn = false): void {
  if (process.platform !== "win32") return;
  app.setLoginItemSettings({
    openAtLogin: forceOn || !!config.autoLaunchAtStartup,
    path: process.execPath,
    args: ["--hidden"],
  });
}

// Pulls the host's schedule from the server and reconciles both the local
// login-item (auto-launch on boot/sign-in) and the OS wake-up tasks so they
// stay in sync with whatever the hoster last saved on the web dashboard —
// without requiring the hoster to touch the agent's own settings.
async function syncScheduleFromServer(): Promise<void> {
  const cfg = await loadConfig();
  if (!cfg.hostToken || !cfg.apiBaseUrl) return;
  const schedule = await fetchHostSchedule(cfg.hostToken, cfg.apiBaseUrl);
  if (!schedule) return;

  const isScheduled = schedule.scheduleMode === "scheduled" && schedule.scheduleJson.length > 0;
  // A host with an active schedule must come back up on its own — force the
  // login item on regardless of the user's local toggle, without persisting
  // over their saved preference (so the UI checkbox still reflects intent).
  applyAutoLaunch(cfg, isScheduled);

  await syncWakeTasks(schedule.scheduleMode, schedule.scheduleJson);
}

void app.whenReady().then(() =>
  startAgent().catch((err) => {
    showFatalError(
      "Агент не смог запуститься",
      `Ошибка при старте: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    );
  }),
);

let pendingBindCode: string | null = null;

function parseBindCodeFromArgv(): string | null {
  for (const arg of process.argv) {
    if (arg.startsWith("--bind-code=")) {
      const code = arg.slice("--bind-code=".length).trim();
      return code || null;
    }
  }
  return null;
}

async function startAgent(): Promise<void> {
  initSentryMain();
  initInputInjector();
  initGamepadInjector();
  pendingBindCode = parseBindCodeFromArgv();
  const config = await loadConfig();
  applyAutoLaunch(config);
  void syncScheduleFromServer();

  createTray(() => {
    createWindow();
  });

  // After first bind (hostToken saved): start in tray. Window only on tray click.
  // Fresh install (no token) still shows the window for setup.
  const startHidden =
    process.argv.includes("--hidden") || Boolean(config.hostToken?.trim());
  if (!startHidden) {
    createWindow();
  } else if (Notification.isSupported() && config.hostToken?.trim()) {
    new Notification({
      title: "Агент DecentralHub",
      body: "Работает в трее. Кликни по иконке, чтобы открыть настройки.",
    }).show();
  }

  // koffi failed to load on Windows → the player would see the stream but be
  // unable to control the game. Warn loudly with a fix hint instead of
  // failing silently at the first input event.
  const injStatus = getInjectorStatus();
  if (!injStatus.ok) {
    dialog.showErrorBox("Модуль управления не загрузился", injStatus.error);
  }

  initAutoUpdater();

  ipcMain.handle("config:get", async () => {
    return loadConfig();
  });

  ipcMain.handle("agent:consume-pending-bind-code", (): string | null => {
    const code = pendingBindCode;
    pendingBindCode = null;
    return code;
  });

  ipcMain.handle("config:set", async (_e, next: unknown) => {
    if (!isHostConfig(next)) {
      throw new Error("Invalid HostConfig payload");
    }
    const saved = await saveConfig(next);
    applyAutoLaunch(saved);
    void syncScheduleFromServer();
    return saved;
  });

  ipcMain.on("input:inject", (_e, event: unknown) => {
    const parsed = parseInputEvent(event);
    if (!parsed) {
      log("warn", "[ipc] Rejected malformed input:inject payload");
      return;
    }
    injectInput(parsed);
  });

  ipcMain.on("gamepad:inject", (_e, state: unknown) => {
    const parsed = parseGamepadState(state);
    if (!parsed) {
      log("warn", "[ipc] Rejected malformed gamepad:inject payload");
      return;
    }
    injectGamepad(parsed);
  });

  ipcMain.handle("agent:get-gamepad-status", () => getGamepadInjectorStatus());

  ipcMain.on("capture:set-source", (_e, title: unknown) => {
    currentCaptureTitle = typeof title === "string" ? title : "";
    syncRtmpWindowTitle(currentCaptureTitle);
  });

  ipcMain.on("status:set", (_e, status: unknown, message?: unknown) => {
    if (
      status !== "idle" &&
      status !== "connecting" &&
      status !== "streaming" &&
      status !== "error"
    ) {
      return;
    }
    const msg = typeof message === "string" ? message : undefined;
    setStatus(status, msg);
    void (async () => {
      const cfg = await loadConfig();
      if (status === "streaming" && cfg.hostToken && cfg.apiBaseUrl) {
        const relay = await fetchStreamRelayConfig(cfg.hostToken, cfg.apiBaseUrl);
        if (relay) {
          const result = startRtmpRelay(relay, {
            windowTitle: currentCaptureTitle || undefined,
          });
          if (!result.ok) log("warn", `[rtmp] ${result.error ?? "start failed"}`);
        }
      } else if (status === "idle" || status === "error") {
        stopRtmpRelay();
        currentCaptureTitle = "";
      }
    })();
  });

  ipcMain.handle("input:set-guard", (_e, pid: number | null, guardDisabled?: boolean) => {
    setAllowedTarget(pid, { guardDisabled: guardDisabled ?? false });
    return getFocusGuardStatus();
  });
  ipcMain.handle("input:clear-guard", () => {
    clearAllowedTarget();
    return getFocusGuardStatus();
  });
  ipcMain.handle("input:get-guard-status", () => getFocusGuardStatus());
  ipcMain.on("input:clear-block", () => {
    setInputBlocked(false);
  });

  ipcMain.on("gamepad:inject", (_e, state: { axes: number[]; buttons: number[] }) => {
    injectGamepad(state);
  });
  ipcMain.on("gamepad:connect", () => {
    connectGamepad();
  });
  ipcMain.on("gamepad:disconnect", () => {
    disconnectGamepad();
  });

  ipcMain.handle("agent:get-gamepad-injector-status", () => getGamepadInjectorStatus());

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

  ipcMain.handle(
    "capture:match-spawned",
    async (): Promise<{ id: string; name: string } | null> => {
      const pid = getLaunchedGamePid();
      if (!pid) return null;
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 0, height: 0 },
      });
      const match = matchSpawnedCaptureSource(
        sources.map((s) => ({ id: s.id, name: s.name })),
        pid,
      );
      return match ?? null;
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
  ipcMain.handle("app:launch-entry", async (_e, entry: unknown) => {
    if (!isGameEntryLaunch(entry)) {
      return { ok: false, error: "Invalid launch entry" };
    }
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

      const prevSeenAppIds = new Set(scanState.seenAppIds ?? []);

      const enriched = steamGames.map((sg) => {
        const catalogGame = catalogByAppId.get(sg.appId) ?? null;
        const alreadyInLibrary =
          addedAppIds.has(sg.appId) ||
          (catalogGame !== null && libraryGameIds.has(catalogGame.id));
        // isNewDiscovery = true on the very first time we see this appId.
        const isNewDiscovery = !prevSeenAppIds.has(sg.appId);
        return {
          appId: sg.appId,
          name: sg.name,
          installDir: sg.installDir,
          fullInstallPath: sg.fullInstallPath,
          bestExePath: sg.bestExePath,
          catalogGame,
          alreadyInLibrary,
          isNewDiscovery,
        };
      });

      // Persist: update seenAppIds with every appId from this scan so subsequent
      // scans can show only newly installed games (delta mode).
      const mergedSeenAppIds = Array.from(
        new Set([...(scanState.seenAppIds ?? []), ...steamGames.map((g) => g.appId)]),
      );
      await saveScanState({
        addedAppIds: scanState.addedAppIds,
        seenAppIds: mergedSeenAppIds,
        lastScanAt: new Date().toISOString(),
      });
      log("info", `[steam-scan] seenAppIds updated: ${mergedSeenAppIds.length} total`);

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

  ipcMain.handle(
    "save-sync:pull",
    async (_e, req: SaveSyncRequest): Promise<SaveSyncResult> => {
      return pullSave({
        hostToken: req.hostToken,
        apiBaseUrl: req.apiBaseUrl,
        sessionId: req.sessionId,
        saveOpts: {
          steamAppId: req.steamAppId,
          appPath: req.appPath,
        },
      });
    },
  );

  ipcMain.handle(
    "save-sync:push",
    async (_e, req: SaveSyncRequest): Promise<SaveSyncResult> => {
      return pushSave({
        hostToken: req.hostToken,
        apiBaseUrl: req.apiBaseUrl,
        sessionId: req.sessionId,
        saveOpts: {
          steamAppId: req.steamAppId,
          appPath: req.appPath,
        },
      });
    },
  );

  ipcMain.on(
    "log",
    (_e, level: "info" | "warn" | "error", message: string) => {
      log(level, `[renderer] ${message}`);
    },
  );

  // ── Local HTTP ping server ────────────────────────────────────────────────
  // The web dashboard pings http://localhost:18080/ping to detect whether the
  // agent is running. POST /input requires X-Agent-Input-Secret.
  const makePingDeps = () => ({
    getInfo: async () => {
      const cfg = await loadConfig().catch(() => null);
      return {
        version: "0.1.0",
        audioMode: cfg?.audioMode ?? "off",
        port: pingPortInUse,
      };
    },
    injectInput,
    log,
    getInputSecret: () => LOCAL_INPUT_SECRET,
    getAllowedOrigins: () => allowedCorsOriginsFromConfig(getCachedConfig()),
  });

  async function bindPingServer(): Promise<void> {
    const ports = [PING_PORT, ...PING_PORT_FALLBACKS];
    for (const port of ports) {
      pingServer = createPingServer(makePingDeps());
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (err: NodeJS.ErrnoException) => {
            pingServer?.off("listening", onListening);
            reject(err);
          };
          const onListening = () => {
            pingServer?.off("error", onError);
            resolve();
          };
          pingServer!.once("error", onError);
          pingServer!.once("listening", onListening);
          pingServer!.listen(port, "127.0.0.1");
        });
        pingPortInUse = port;
        log("info", `Ping server listening on http://127.0.0.1:${pingPortInUse}`);
        if (port !== PING_PORT) {
          const msg =
            `Порт ${PING_PORT} занят — агент слушает ${pingPortInUse}. ` +
            `Проверь, что не запущен второй экземпляр.`;
          log("warn", msg);
          if (Notification.isSupported()) {
            new Notification({ title: "Порт агента занят", body: msg }).show();
          }
        }
        return;
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        log("warn", `Ping server port ${port} failed: ${e.message}`);
        try {
          pingServer.close();
        } catch {
          /* ignore */
        }
        pingServer = null;
        if (e.code !== "EADDRINUSE") break;
      }
    }
    const msg =
      `Не удалось занять порты ${ports.join(", ")} — ` +
      `дашборд не увидит агент, управление browser-play недоступно.`;
    log("error", msg);
    if (Notification.isSupported()) {
      new Notification({ title: "Агент: порт занят", body: msg }).show();
    }
  }

  await bindPingServer();

  // Injector status for the renderer's diagnostics panel.
  ipcMain.handle("agent:get-injector-status", () => getInjectorStatus());

  ipcMain.handle(
    "saves:restore",
    async (
      _e,
      manifest: SaveManifestEntry[],
      downloadUrl: string,
    ) => restoreSave(manifest, downloadUrl),
  );
  ipcMain.handle(
    "saves:backup",
    async (
      _e,
      manifest: SaveManifestEntry[],
      uploadUrl: string,
    ) => backupSave(manifest, uploadUrl),
  );

  // ── Crypto key & PC binding ───────────────────────────────────────────────
  // Load (or generate) the Ed25519 key pair on startup.
  let keyStore: { privateKeyHex: string; publicKeyHex: string } | null = null;
  try {
    keyStore = await loadOrGenerateKeyPair();
    log("info", `Agent pubkey: ${keyStore.publicKeyHex.slice(0, 16)}…`);
  } catch (err) {
    log("warn", `Failed to load/generate key pair: ${String(err)}`);
  }

  // Collect local PC specs (GPU via wmic on Windows, CPU + RAM from Node os).
  function collectPcSpecs(): { gpu: string; cpu: string; ramGb: number } {
    const cpus = os.cpus();
    const cpu =
      cpus.length > 0
        ? `${cpus[0]?.model ?? "Unknown"} (${cpus.length} cores)`
        : "Unknown";
    const ramGb = Math.round(os.totalmem() / 1024 ** 3);

    let gpu = "Unknown";
    if (process.platform === "win32") {
      try {
        const out = execSync(
          "wmic path Win32_VideoController get Name /value",
          { timeout: 5000 },
        ).toString();
        const match = out.match(/Name=([^\r\n]+)/);
        if (match?.[1]) gpu = match[1].trim();
      } catch {
        // wmic unavailable or timeout — leave gpu as "Unknown"
      }
    }
    return { gpu, cpu, ramGb };
  }

  // Returns the hex-encoded public key (or null when no key is available).
  ipcMain.handle("agent:get-pubkey", (): string | null => {
    return keyStore?.publicKeyHex ?? null;
  });

  // Fetches a challenge from the server, signs it, and binds the public key
  // to the host account identified by `hostToken`.
  ipcMain.handle(
    "agent:bind-key",
    async (
      _e,
      hostToken: string,
      apiBaseUrl: string,
      bindCode?: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!keyStore) return { ok: false, error: "Key pair not available" };
      const base = apiBaseUrl.replace(/\/$/, "");
      const code =
        typeof bindCode === "string" && bindCode.trim() ? bindCode.trim() : "";
      const token =
        typeof hostToken === "string" && hostToken.trim() ? hostToken.trim() : "";
      if (!code && !token) {
        return { ok: false, error: "Нужен код привязки или host token" };
      }
      try {
        const challengeResp = await fetch(`${base}/api/auth/agent-challenge`);
        if (!challengeResp.ok) {
          return { ok: false, error: `Challenge fetch failed (${challengeResp.status})` };
        }
        const { challenge } = (await challengeResp.json()) as { challenge: string };
        const signature = signChallenge(keyStore.privateKeyHex, challenge);
        const body: Record<string, string> = {
          pubkey: keyStore.publicKeyHex,
          challenge,
          signature,
        };
        if (code) body.bindCode = code;
        else body.hostToken = token;
        const bindResp = await fetch(`${base}/api/auth/bind-agent-key`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!bindResp.ok) {
          const errBody = (await bindResp.json()) as { error?: string };
          return { ok: false, error: errBody.error ?? `HTTP ${bindResp.status}` };
        }
        log("info", "[agent-key] Key bound to account successfully");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  );

  // Fetches a challenge, signs it, and calls agent-login to get a hostToken.
  // Does NOT put the long-lived token in the browser URL (history/Referer leak).
  // Instead: save into agent config, copy to clipboard, open dashboard cleanly.
  ipcMain.handle(
    "agent:login",
    async (
      _e,
      apiBaseUrl: unknown,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!keyStore) return { ok: false, error: "Key pair not available" };
      if (typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) {
        return { ok: false, error: "apiBaseUrl required" };
      }
      const base = apiBaseUrl.replace(/\/$/, "");
      try {
        const challengeResp = await fetch(`${base}/api/auth/agent-challenge`);
        if (!challengeResp.ok) {
          return { ok: false, error: `Challenge fetch failed (${challengeResp.status})` };
        }
        const { challenge } = (await challengeResp.json()) as { challenge: string };
        const signature = signChallenge(keyStore.privateKeyHex, challenge);
        const loginResp = await fetch(`${base}/api/auth/agent-login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pubkey: keyStore.publicKeyHex,
            challenge,
            signature,
          }),
        });
        if (!loginResp.ok) {
          const body = (await loginResp.json()) as { error?: string };
          return { ok: false, error: body.error ?? `HTTP ${loginResp.status}` };
        }
        const { hostToken } = (await loginResp.json()) as { hostToken: string };
        const cfg = await loadConfig();
        await saveConfig({ ...cfg, hostToken, apiBaseUrl: base });
        try {
          clipboard.writeText(hostToken);
        } catch (err) {
          log("warn", `[agent-login] clipboard write failed: ${String(err)}`);
        }
        const dashboardUrl = `${base}/host/dashboard`;
        await shell.openExternal(dashboardUrl);
        if (Notification.isSupported()) {
          new Notification({
            title: "Вход через агент",
            body:
              "Токен хоста скопирован в буфер обмена. " +
              "Вставь его в настройках сайта, если дашборд попросит авторизацию.",
          }).show();
        }
        log("info", "[agent-key] Opened dashboard without token in URL; token copied to clipboard");
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  );

  // Collects PC specs and uploads them to the platform.
  ipcMain.handle(
    "agent:update-pc-specs",
    async (
      _e,
      hostToken: string,
      apiBaseUrl: string,
    ): Promise<{ ok: boolean; error?: string; pcSpecs?: { gpu: string; cpu: string; ramGb: number } }> => {
      const base = apiBaseUrl.replace(/\/$/, "");
      try {
        const pcSpecs = collectPcSpecs();
        const resp = await fetch(`${base}/api/hosts/me/pc-specs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hostToken, ...pcSpecs }),
        });
        if (!resp.ok) {
          const body = (await resp.json()) as { error?: string };
          return { ok: false, error: body.error ?? `HTTP ${resp.status}` };
        }
        log("info", `[pc-specs] Updated: GPU=${pcSpecs.gpu}, CPU=${pcSpecs.cpu}, RAM=${pcSpecs.ramGb}GB`);
        return { ok: true, pcSpecs };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  );

  // Returns local PC specs without uploading them (used for display in UI).
  ipcMain.handle("agent:get-pc-specs", (): { gpu: string; cpu: string; ramGb: number } => {
    return collectPcSpecs();
  });

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  // Keep hosts.lastSeenAt fresh so the server can detect crashes/disconnects
  // and auto-terminate ghost sessions. Fire every 15s; silently skipped
  // when config lacks hostToken or apiBaseUrl.
  const HEARTBEAT_INTERVAL_MS = 15_000;
  trackInterval(
    setInterval(() => {
      void loadConfig().then((cfg) => {
        if (cfg.hostToken && cfg.apiBaseUrl) {
          void sendHeartbeat(cfg.hostToken, cfg.apiBaseUrl);
        }
      });
    }, HEARTBEAT_INTERVAL_MS),
  );

  // ── Schedule sync (auto-launch + wake tasks) ────────────────────────────
  // Re-pull the schedule periodically so changes saved on the web dashboard
  // take effect on this PC even without an agent restart or manual save.
  const SCHEDULE_SYNC_INTERVAL_MS = 5 * 60_000;
  trackInterval(
    setInterval(() => {
      void syncScheduleFromServer();
    }, SCHEDULE_SYNC_INTERVAL_MS),
  );

  // ── Auto-quota scheduler ──────────────────────────────────────────────────
  // Runs in the main process (survives renderer reloads) so the 60s polling
  // tick is never affected by renderer lifecycle events. The main process
  // tracks the currently-attached quota and pushes status updates to the
  // renderer via "quota:status" events.

  let mqCurrentId: string | null = null;
  let mqCurrentTitle: string | null = null;

  function sendQuotaStatus(ev: QuotaStatusEvent): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("quota:status", ev);
    }
  }

  async function runAutoQuotaCycle(): Promise<void> {
    const cfg = await loadConfig();
    if (!cfg.autoQuotaEnabled || !cfg.hostToken || !cfg.apiBaseUrl) return;

    const base = cfg.apiBaseUrl.replace(/\/$/, "");
    const ht = encodeURIComponent(cfg.hostToken);

    try {
      // ── Step 1: verify the currently-attached quota is still valid ─────────
      // If it has become exhausted / expired / closed, clear our local state
      // so the next step picks a fresh one.
      if (mqCurrentId) {
        const curResp = await fetch(`${base}/api/hosts/me/current-quota?hostToken=${ht}`);
        if (curResp.ok) {
          const cur = (await curResp.json()) as {
            quota: { id: string; status?: string } | null;
          };
          // If the server reports no quota or a different / non-active quota,
          // clear state so we re-match below.
          if (
            !cur.quota ||
            cur.quota.id !== mqCurrentId ||
            (cur.quota.status && cur.quota.status !== "active")
          ) {
            log("info", `[auto-quota] Attached quota ${mqCurrentId} is no longer valid — re-matching.`);
            mqCurrentId = null;
            mqCurrentTitle = null;
          } else {
            // Still attached and active — nothing to do this cycle.
            sendQuotaStatus({
              statusText: `Сейчас работаю по квоте: ${mqCurrentTitle ?? cur.quota.id}`,
              attachedQuotaId: mqCurrentId,
              attachedQuotaTitle: mqCurrentTitle,
              hasAttached: true,
            });
            return;
          }
        }
      }

      // ── Step 2: fetch matching quotas ──────────────────────────────────────
      sendQuotaStatus({
        statusText: "Ищу подходящие квоты…",
        attachedQuotaId: null,
        attachedQuotaTitle: null,
        hasAttached: false,
      });

      const matchResp = await fetch(`${base}/api/quotas/match-my-host?hostToken=${ht}`);
      if (!matchResp.ok) {
        sendQuotaStatus({
          statusText: "Ошибка при запросе квот.",
          attachedQuotaId: null,
          attachedQuotaTitle: null,
          hasAttached: false,
        });
        return;
      }

      const quotas = (await matchResp.json()) as Array<{
        id: string;
        title: string;
        kind: string;
        escrowRemainingLzt?: number;
      }>;

      if (quotas.length === 0) {
        sendQuotaStatus({
          statusText: "Нет подходящих задач, попробую через минуту.",
          attachedQuotaId: null,
          attachedQuotaTitle: null,
          hasAttached: false,
        });
        return;
      }

      // ── Step 3: try to attach in profitability order ───────────────────────
      for (const quota of quotas) {
        const attachResp = await fetch(`${base}/api/hosts/me/attach-quota`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hostToken: cfg.hostToken, quotaId: quota.id }),
        });

        if (attachResp.status === 409) {
          // Session already has a different quota — skip and try the next.
          log("info", `[auto-quota] Quota «${quota.title}» already taken (409) — trying next.`);
          continue;
        }

        if (attachResp.ok) {
          mqCurrentId = quota.id;
          mqCurrentTitle = quota.title;
          log("info", `[auto-quota] Attached quota «${quota.title}»`);
          sendQuotaStatus({
            statusText: `Сейчас работаю по квоте: ${quota.title}`,
            attachedQuotaId: quota.id,
            attachedQuotaTitle: quota.title,
            hasAttached: true,
          });
          return;
        }

        log("warn", `[auto-quota] Attach «${quota.title}» failed (${attachResp.status}) — skipping.`);
      }

      sendQuotaStatus({
        statusText: "Нет подходящих задач, попробую через минуту.",
        attachedQuotaId: null,
        attachedQuotaTitle: null,
        hasAttached: false,
      });
    } catch (err) {
      log("warn", `[auto-quota] Cycle error: ${String(err)}`);
      sendQuotaStatus({
        statusText: "Ошибка сети при подборе квоты.",
        attachedQuotaId: null,
        attachedQuotaTitle: null,
        hasAttached: false,
      });
    }
  }

  // IPC: renderer requests an immediate quota match cycle (e.g. after toggle ON).
  ipcMain.on("quota:run-cycle", () => {
    void runAutoQuotaCycle();
  });

  // IPC: renderer requests detach — main process calls the API and resets state.
  ipcMain.handle("quota:detach", async (): Promise<{ ok: boolean }> => {
    const cfg = await loadConfig();
    if (!cfg.hostToken || !cfg.apiBaseUrl) return { ok: false };
    const base = cfg.apiBaseUrl.replace(/\/$/, "");
    try {
      const resp = await fetch(`${base}/api/hosts/me/detach-quota`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostToken: cfg.hostToken }),
      });
      if (resp.ok) {
        mqCurrentId = null;
        mqCurrentTitle = null;
        log("info", "[auto-quota] Quota detached by user. Searching for next…");
        // Immediately try to find a new quota after detach.
        void runAutoQuotaCycle();
      }
      return { ok: resp.ok };
    } catch {
      return { ok: false };
    }
  });

  // IPC: renderer asks for the current quota state (e.g. on window re-open).
  ipcMain.handle("quota:get-state", (): QuotaStatusEvent => {
    if (mqCurrentId) {
      return {
        statusText: `Сейчас работаю по квоте: ${mqCurrentTitle ?? mqCurrentId}`,
        attachedQuotaId: mqCurrentId,
        attachedQuotaTitle: mqCurrentTitle,
        hasAttached: true,
      };
    }
    return {
      statusText: "Автоподбор активен. Жду подходящей квоты…",
      attachedQuotaId: null,
      attachedQuotaTitle: null,
      hasAttached: false,
    };
  });

  // 60-second polling loop — same pattern as the heartbeat.
  const AUTO_QUOTA_INTERVAL_MS = 60_000;
  trackInterval(
    setInterval(() => {
      void runAutoQuotaCycle();
    }, AUTO_QUOTA_INTERVAL_MS),
  );

  setStatus("idle");
  log("info", "Host agent ready.");

  // Panic hotkey — instantly block all player input and notify renderer.
  const PANIC_ACCEL = "Control+Shift+End";
  const panicRegistered = globalShortcut.register(PANIC_ACCEL, () => {
    log("warn", "[panic] Hotkey pressed — blocking input");
    setInputBlocked(true);
    disconnectGamepad();
    mainWindow?.webContents.send("input:panic");
  });
  if (!panicRegistered) {
    log("warn", `[panic] Failed to register global shortcut ${PANIC_ACCEL}`);
  }
}

app.on("second-instance", () => {
  createWindow();
});

app.on("window-all-closed", () => {
  // Keep the agent running in the tray on Windows even when no window exists;
  // do nothing here so the app stays alive.
});

app.on("before-quit", () => {
  (app as unknown as { isQuitting?: boolean }).isQuitting = true;
  globalShortcut.unregisterAll();
  destroyGamepadInjector();
  for (const handle of lifetimeIntervals) {
    clearInterval(handle);
  }
  lifetimeIntervals.length = 0;
  stopRtmpRelay();
  killApp();
  if (pingServer) {
    try {
      pingServer.close();
    } catch {
      /* ignore */
    }
    pingServer = null;
  }
});

function initAutoUpdater(): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", () => {
    log("info", "Update downloaded — notifying renderer");
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agent:update-ready");
    }
  });

  autoUpdater.on("error", (err: Error) => {
    log("warn", `Auto-updater error: ${String(err)}`);
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
      log("warn", `Update check failed: ${String(err)}`);
    });
  }, 30_000).unref();
}

ipcMain.handle("agent:install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});
