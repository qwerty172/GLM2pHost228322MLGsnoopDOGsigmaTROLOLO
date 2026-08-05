import { contextBridge, ipcRenderer } from "electron";
import type { AgentStatus, HostConfig, InputEvent, GameEntryLaunch, GamepadState, LibraryEntry, SteamScanResult, QuotaStatusEvent, SaveSyncRequest, SaveSyncResult } from "../shared/messages";

const api = {
  getConfig: (): Promise<HostConfig> => ipcRenderer.invoke("config:get"),
  setConfig: (next: HostConfig): Promise<HostConfig> =>
    ipcRenderer.invoke("config:set", next),
  setStatus: (status: AgentStatus, message?: string): void => {
    ipcRenderer.send("status:set", status, message);
  },
  injectInput: (event: InputEvent): void => {
    ipcRenderer.send("input:inject", event);
  },
  setInputGuard: (
    pid: number | null,
    guardDisabled?: boolean,
  ): Promise<{
    active: boolean;
    allowedPid: number | null;
    guardDisabled: boolean;
    foregroundAllowed: boolean;
    inputBlocked: boolean;
  }> => ipcRenderer.invoke("input:set-guard", pid, guardDisabled),
  clearInputGuard: (): Promise<{
    active: boolean;
    allowedPid: number | null;
    guardDisabled: boolean;
    foregroundAllowed: boolean;
    inputBlocked: boolean;
  }> => ipcRenderer.invoke("input:clear-guard"),
  getInputGuardStatus: (): Promise<{
    active: boolean;
    allowedPid: number | null;
    guardDisabled: boolean;
    foregroundAllowed: boolean;
    inputBlocked: boolean;
  }> => ipcRenderer.invoke("input:get-guard-status"),
  clearInputBlock: (): void => {
    ipcRenderer.send("input:clear-block");
  },
  onInputPanic: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("input:panic", handler);
    return () => ipcRenderer.removeListener("input:panic", handler);
  },
  injectGamepad: (state: GamepadState): void => {
    ipcRenderer.send("gamepad:inject", state);
  },
  connectGamepad: (): void => {
    ipcRenderer.send("gamepad:connect");
  },
  disconnectGamepad: (): void => {
    ipcRenderer.send("gamepad:disconnect");
  },
  getGamepadStatus: (): Promise<{ ok: boolean; error: string; platform: string }> =>
    ipcRenderer.invoke("agent:get-gamepad-status"),
  // Legacy single-game launch via HostConfig stored in config file.
  launchApp: (): Promise<{ ok: boolean; pid?: number; error?: string }> =>
    ipcRenderer.invoke("app:launch"),
  // Library-based launch: pass the specific entry to launch.
  launchEntry: (
    entry: GameEntryLaunch,
  ): Promise<{ ok: boolean; pid?: number; error?: string }> =>
    ipcRenderer.invoke("app:launch-entry", entry),
  // Register a one-time listener for the "game process exited" push event from main.
  // When the native child process exits, main sends this so the renderer can
  // auto-end the billing session without polling.
  onGameExited: (cb: () => void): void => {
    ipcRenderer.once("app:game-exited", () => cb());
  },
  getCaptureSources: (): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke("capture:get-sources"),
  getSpawnHwnds: (): Promise<{ pid: number | null; hwnds: number[] }> =>
    ipcRenderer.invoke("app:get-spawn-hwnds"),
  /** Tell main which window title WebRTC is capturing (for RTMP sync). */
  setCaptureSource: (title: string): void => {
    ipcRenderer.send("capture:set-source", title);
  },
  killApp: (): void => {
    ipcRenderer.send("app:kill");
  },
  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke("dialog:open-file"),
  // Fetch the host's game library from the server.
  // Main process also validates local paths and reports availability.
  fetchLibrary: (
    hostToken: string,
    apiBaseUrl: string,
  ): Promise<LibraryEntry[]> =>
    ipcRenderer.invoke("library:fetch", hostToken, apiBaseUrl),
  // Report corrected availability after user changes appPath via dialog.
  patchLibraryAvailability: (
    hostToken: string,
    apiBaseUrl: string,
    gameId: string,
    localAvailable: boolean,
    lastError?: string,
  ): Promise<void> =>
    ipcRenderer.invoke(
      "library:patch-availability",
      hostToken,
      apiBaseUrl,
      gameId,
      localAvailable,
      lastError,
    ),
  // Open Windows Explorer at the folder containing the given file.
  openExplorer: (filePath: string): void => {
    ipcRenderer.send("library:open-explorer", filePath);
  },
  // Scan the local Steam installation and match against the platform catalog.
  // Windows-only — returns an empty game list with an error message on other OSes.
  scanSteam: (hostToken: string, apiBaseUrl: string): Promise<SteamScanResult> =>
    ipcRenderer.invoke("steam:scan", hostToken, apiBaseUrl),
  // Persist the set of steamAppIds that were successfully added during this session.
  markSteamGamesAdded: (appIds: string[]): Promise<void> =>
    ipcRenderer.invoke("steam:mark-added", appIds),
  // Returns "win32" | "darwin" | "linux" so the renderer can hide Windows-only UI.
  platform: process.platform,
  log: (level: "info" | "warn" | "error", message: string): void => {
    ipcRenderer.send("log", level, message);
  },

  // ── Crypto key & PC binding ─────────────────────────────────────────────
  // Returns the hex-encoded Ed25519 public key, or null if not yet generated.
  getAgentPubkey: (): Promise<string | null> =>
    ipcRenderer.invoke("agent:get-pubkey"),
  // Binds this agent's public key to the host account.
  // Prefer one-time bindCode from the dashboard; hostToken still works (legacy).
  bindAgentKey: (
    hostToken: string,
    apiBaseUrl: string,
    bindCode?: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("agent:bind-key", hostToken, apiBaseUrl, bindCode),
  consumePendingBindCode: (): Promise<string | null> =>
    ipcRenderer.invoke("agent:consume-pending-bind-code"),
  // Opens the web dashboard in the browser, authenticated via key signature.
  agentLogin: (
    apiBaseUrl: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("agent:login", apiBaseUrl),
  // Uploads PC specs (GPU/CPU/RAM) to the platform API.
  updatePcSpecs: (
    hostToken: string,
    apiBaseUrl: string,
  ): Promise<{ ok: boolean; error?: string; pcSpecs?: { gpu: string; cpu: string; ramGb: number } }> =>
    ipcRenderer.invoke("agent:update-pc-specs", hostToken, apiBaseUrl),
  // Returns local PC specs without uploading them.
  getPcSpecs: (): Promise<{ gpu: string; cpu: string; ramGb: number }> =>
    ipcRenderer.invoke("agent:get-pc-specs"),
  // Input injector (koffi/SendInput) health — for the diagnostics panel.
  getInjectorStatus: (): Promise<{ ok: boolean; error: string; platform: string }> =>
    ipcRenderer.invoke("agent:get-injector-status"),
  getGamepadInjectorStatus: (): Promise<{ ok: boolean; error: string; platform: string; connected: boolean }> =>
    ipcRenderer.invoke("agent:get-gamepad-injector-status"),

  // ── Auto-quota (main-process scheduler) ──────────────────────────────────
  // Register a listener that fires every time the main process emits a
  // quota status update (after each 60s cycle, or immediately after detach).
  // Returns a cleanup function that removes the listener.
  onQuotaStatus: (cb: (ev: QuotaStatusEvent) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, ev: QuotaStatusEvent) => cb(ev);
    ipcRenderer.on("quota:status", handler);
    return () => ipcRenderer.off("quota:status", handler);
  },
  // Ask the main process to run an immediate match cycle.
  quotaRunCycle: (): void => {
    ipcRenderer.send("quota:run-cycle");
  },
  // Detach the current quota (main process calls the API and resets state).
  quotaDetach: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("quota:detach"),
  // Get the current quota state snapshot (for renderer re-init on window open).
  quotaGetState: (): Promise<QuotaStatusEvent> =>
    ipcRenderer.invoke("quota:get-state"),

  saveSyncPull: (req: SaveSyncRequest): Promise<SaveSyncResult> =>
    ipcRenderer.invoke("save-sync:pull", req),
  saveSyncPush: (req: SaveSyncRequest): Promise<SaveSyncResult> =>
    ipcRenderer.invoke("save-sync:push", req),
  savesRestore: (
    manifest: { label: string; pathTemplate: string; provider: "steam" | "custom" }[],
    downloadUrl: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("saves:restore", manifest, downloadUrl),
  savesBackup: (
    manifest: { label: string; pathTemplate: string; provider: "steam" | "custom" }[],
    uploadUrl: string,
  ): Promise<{ ok: boolean; sizeBytes?: number; error?: string }> =>
    ipcRenderer.invoke("saves:backup", manifest, uploadUrl),

  onUpdateReady: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on("agent:update-ready", handler);
    return () => ipcRenderer.off("agent:update-ready", handler);
  },
  installUpdate: (): Promise<void> => ipcRenderer.invoke("agent:install-update"),
  checkVersionPolicy: (
    apiBaseUrl: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("agent:check-version-policy", apiBaseUrl),
};

contextBridge.exposeInMainWorld("agent", api);

declare global {
  // Mirror the API on window for renderer TypeScript.
  interface Window {
    agent: typeof api;
  }
}
