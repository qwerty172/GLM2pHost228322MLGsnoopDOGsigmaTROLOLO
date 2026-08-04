import type {
  AgentStatus,
  HostConfig,
  InputEvent,
  LibraryEntry,
  SaveSyncRequest,
  SaveSyncResult,
  SteamScanGame,
  SteamScanResult,
} from "../shared/messages";

// The preload script (src/preload/index.ts) exposes this API on `window.agent`
// via contextBridge. Re-declare the surface here so the renderer typechecks
// without depending on the preload's CommonJS module graph.
declare global {
  interface Window {
    agent: {
      getConfig: () => Promise<HostConfig>;
      setConfig: (next: HostConfig) => Promise<HostConfig>;
      setStatus: (status: AgentStatus, message?: string) => void;
      injectInput: (event: InputEvent) => void;
      setInputGuard: (
        pid: number | null,
        guardDisabled?: boolean,
      ) => Promise<{
        active: boolean;
        allowedPid: number | null;
        guardDisabled: boolean;
        foregroundAllowed: boolean;
        inputBlocked: boolean;
      }>;
      clearInputGuard: () => Promise<{
        active: boolean;
        allowedPid: number | null;
        guardDisabled: boolean;
        foregroundAllowed: boolean;
        inputBlocked: boolean;
      }>;
      getInputGuardStatus: () => Promise<{
        active: boolean;
        allowedPid: number | null;
        guardDisabled: boolean;
        foregroundAllowed: boolean;
        inputBlocked: boolean;
      }>;
      clearInputBlock: () => void;
      onInputPanic: (cb: () => void) => () => void;
      injectGamepad: (state: { axes: number[]; buttons: number[] }) => void;
      connectGamepad: () => void;
      disconnectGamepad: () => void;
      getGamepadStatus: () => Promise<{ ok: boolean; error: string; platform: string }>;
      launchApp: () => Promise<{ ok: boolean; pid?: number; error?: string }>;
      launchEntry: (entry: {
        appPath: string;
        boundUrl: string;
        launchArgs: string;
      }) => Promise<{ ok: boolean; pid?: number; error?: string }>;
      onGameExited: (cb: () => void) => void;
      getCaptureSources: () => Promise<{ id: string; name: string }[]>;
      setCaptureSource: (title: string) => void;
      killApp: () => void;
      stopSessionWatch: () => void;
      openFileDialog: () => Promise<string | null>;
      fetchLibrary: (
        hostToken: string,
        apiBaseUrl: string,
      ) => Promise<LibraryEntry[]>;
      patchLibraryAvailability: (
        hostToken: string,
        apiBaseUrl: string,
        gameId: string,
        localAvailable: boolean,
        lastError?: string,
      ) => Promise<void>;
      openExplorer: (filePath: string) => void;
      scanSteam: (hostToken: string, apiBaseUrl: string) => Promise<SteamScanResult>;
      markSteamGamesAdded: (appIds: string[]) => Promise<void>;
      platform: string;
      log: (level: "info" | "warn" | "error", message: string) => void;
      getAgentPubkey: () => Promise<string | null>;
      bindAgentKey: (
        hostToken: string,
        apiBaseUrl: string,
        bindCode?: string,
      ) => Promise<{ ok: boolean; error?: string }>;
      consumePendingBindCode: () => Promise<string | null>;
      agentLogin: (apiBaseUrl: string) => Promise<{ ok: boolean; error?: string }>;
      updatePcSpecs: (hostToken: string, apiBaseUrl: string) => Promise<{ ok: boolean; error?: string; pcSpecs?: { gpu: string; cpu: string; ramGb: number } }>;
      getPcSpecs: () => Promise<{ gpu: string; cpu: string; ramGb: number }>;
      getInjectorStatus: () => Promise<{ ok: boolean; error: string; platform: string }>;
      getGamepadInjectorStatus: () => Promise<{ ok: boolean; error: string; platform: string; connected: boolean }>;
      onQuotaStatus: (cb: (ev: { statusText: string; attachedQuotaId: string | null; attachedQuotaTitle: string | null; hasAttached: boolean }) => void) => () => void;
      quotaRunCycle: () => void;
      quotaDetach: () => Promise<{ ok: boolean }>;
      quotaGetState: () => Promise<{ statusText: string; attachedQuotaId: string | null; attachedQuotaTitle: string | null; hasAttached: boolean }>;
      saveSyncPull: (req: SaveSyncRequest) => Promise<SaveSyncResult>;
      saveSyncPush: (req: SaveSyncRequest) => Promise<SaveSyncResult>;
    };
  }
}

export {};
