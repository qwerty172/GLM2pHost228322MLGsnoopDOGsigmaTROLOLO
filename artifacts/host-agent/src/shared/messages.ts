// Shared message types between main, preload, and renderer.

export type AgentStatus = "idle" | "connecting" | "streaming" | "error";

export interface HostConfig {
  hostToken: string;
  // Base HTTPS URL of the platform API, e.g. https://gaming.example.com
  apiBaseUrl: string;
  // Optional override; when blank we derive ws(s)://<apiBaseUrl>/api/signal.
  signalingUrl: string;
  appPath: string;
  appArgs?: string;
  appName?: string;
  // Browser-game URL. When non-empty the agent opens this in the system
  // browser instead of spawning appPath.
  boundUrl?: string;
  // Optional explicit capture source name (window title or screen label) as
  // returned by Electron's desktopCapturer. When unset, we match by the
  // launched .exe basename and fall back to the primary screen.
  captureSourceName?: string;
  ratePerMinute: number;
  // Host's share of the per-minute rate (0..1). The remainder is the
  // platform's commission split. Defaults to 0.7 (host keeps 70%).
  commissionSplit: number;
  resolution: { width: number; height: number };
  bitrateKbps: number;
  killAppOnDisconnect: boolean;
  autoLaunchAtStartup: boolean;
}

export type InputEvent =
  // mode === "absolute" (default): x/y are normalized to [0..1] over the
  //   streamed video; the injector scales to SendInput's [0..65535] range.
  // mode === "relative": x/y are signed pixel deltas (e.g. from pointer-lock
  //   movementX/Y) and the injector emits a relative SendInput move.
  | {
      kind: "mousemove";
      x: number;
      y: number;
      mode?: "absolute" | "relative";
    }
  | { kind: "mousedown"; button: "left" | "right" | "middle" }
  | { kind: "mouseup"; button: "left" | "right" | "middle" }
  | { kind: "wheel"; deltaY: number }
  | { kind: "keydown"; code: string; key: string }
  | { kind: "keyup"; code: string; key: string };

// A single entry from the host's multi-game library as returned by
// GET /api/hosts/:hostToken/library. Mirrors the server-side LibraryEntry type.
export interface LibraryEntry {
  id: string;
  hostId: string;
  gameId: string;
  pricePerMinuteLzt: number;
  appPath: string;
  boundUrl: string;
  launchArgs: string;
  enabled: boolean;
  sortOrder: number;
  localAvailable: boolean;
  lastError: string;
  addedAt: string;
  hasActiveSession: boolean;
  game: {
    id: string;
    slug: string;
    title: string;
    coverImageUrl: string;
    genre: string;
    browserHostUrl: string;
    hasMods: boolean;
    isMultiplayer: boolean;
  };
}

// Payload for launching a specific game entry (library-based launch).
export interface GameEntryLaunch {
  appPath: string;
  boundUrl: string;
  launchArgs: string;
}

export interface IpcChannels {
  "config:get": () => HostConfig | null;
  "config:set": (config: HostConfig) => HostConfig;
  "status:set": (status: AgentStatus, message?: string) => void;
  "input:inject": (event: InputEvent) => void;
  "app:launch": () => { ok: boolean; pid?: number; error?: string };
  "app:launch-entry": (entry: GameEntryLaunch) => { ok: boolean; pid?: number; error?: string };
  "app:kill": () => void;
  "library:open-explorer": (filePath: string) => void;
  "log": (level: "info" | "warn" | "error", message: string) => void;
}
