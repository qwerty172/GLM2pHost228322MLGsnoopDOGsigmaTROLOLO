import { contextBridge, ipcRenderer } from "electron";
import type { AgentStatus, HostConfig, InputEvent, GameEntryLaunch, LibraryEntry, SteamScanResult } from "../shared/messages";

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
};

contextBridge.exposeInMainWorld("agent", api);

declare global {
  // Mirror the API on window for renderer TypeScript.
  interface Window {
    agent: typeof api;
  }
}
