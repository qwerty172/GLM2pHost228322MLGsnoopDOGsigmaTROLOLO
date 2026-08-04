// Shared message types between main, preload, and renderer.

export type AgentStatus = "idle" | "connecting" | "streaming" | "error";

// Mirrors lib/db's ScheduleSlot — a single weekly availability window.
// day: 0 = Sunday … 6 = Saturday. startMin/endMin: minutes-from-midnight, UTC.
export interface ScheduleSlot {
  day: number;
  startMin: number;
  endMin: number;
}

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
  autoQuotaEnabled?: boolean;
  // When false, the agent will not accept preview connections from players.
  // Defaults to true (preview enabled).
  allowPreview?: boolean;
  // Audio capture mode for WASAPI loopback (Windows only).
  // off    — no audio transmitted (default, same as previous behaviour)
  // voice  — Opus ~12 kbps (highly compressed, low bandwidth)
  // standard — Opus ~32 kbps (balanced quality)
  // quality  — Opus ~64 kbps (high fidelity)
  audioMode?: "off" | "voice" | "standard" | "quality";
  /** Optional isolated Windows user for game launches. */
  limitedUser?: {
    enabled: boolean;
    username: string;
    password: string;
    domain?: string;
  };
  // Capture pipeline: "chromium" (desktopCapturer) or "native" (DXGI/NVENC addon).
  captureMode?: "chromium" | "native";
}

/** Native DXGI/NVENC capture is not implemented (HOSTING H-03); coerce to chromium. */
export function resolveCaptureMode(mode?: "chromium" | "native"): "chromium" {
  return mode === "native" ? "chromium" : (mode ?? "chromium");
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

/** Virtual gamepad state from the mobile touch overlay (XInput layout). */
export interface GamepadState {
  /** Normalized stick axes in [-1, 1]: LX, LY, RX, RY. */
  axes: number[];
  /** Digital buttons 0–9: A, B, X, Y, LB, RB, LT, RT, Select, Start. */
  buttons: number[];
}

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
    steamAppId?: string | null;
  };
}

// Payload for launching a specific game entry (library-based launch).
export interface GameEntryLaunch {
  appPath: string;
  boundUrl: string;
  launchArgs: string;
}

// ─── Steam scan types ─────────────────────────────────────────────────────────

// A single game discovered during the Steam library scan.
export interface SteamScanGame {
  appId: string;
  name: string;
  installDir: string;
  fullInstallPath: string;
  bestExePath: string | null;
  // Matched catalog entry (null when game is not yet in the platform catalog).
  catalogGame: { id: string; title: string; slug: string; coverImageUrl: string } | null;
  // True when the host already has this game in their library.
  alreadyInLibrary: boolean;
  // True when this game was NOT seen in any previous scan (first discovery).
  // False on re-scans for games the host already had installed before.
  isNewDiscovery: boolean;
}

export interface SteamScanResult {
  steamRoot: string | null;
  games: SteamScanGame[];
  error?: string;
}

export interface SaveSyncRequest {
  hostToken: string;
  apiBaseUrl: string;
  sessionId: string;
  gameId: string;
  appPath: string;
  steamAppId?: string | null;
}

export interface SaveSyncResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

// Push event sent from the main process to the renderer to report the
// current auto-quota matching state.
export interface QuotaStatusEvent {
  // Human-readable status line shown in the UI.
  statusText: string;
  // ID of the quota that is currently attached (null when none).
  attachedQuotaId: string | null;
  // Title of the attached quota (null when none).
  attachedQuotaTitle: string | null;
  // Whether to show the "detach" button.
  hasAttached: boolean;
}

export interface IpcChannels {
  "config:get": () => HostConfig | null;
  "config:set": (config: HostConfig) => HostConfig;
  "status:set": (status: AgentStatus, message?: string) => void;
  "input:inject": (event: InputEvent) => void;
  "gamepad:inject": (state: GamepadState) => void;
  "gamepad:connect": () => void;
  "gamepad:disconnect": () => void;
  "app:launch": () => { ok: boolean; pid?: number; error?: string };
  "app:launch-entry": (entry: GameEntryLaunch) => { ok: boolean; pid?: number; error?: string };
  "app:kill": () => void;
  "library:open-explorer": (filePath: string) => void;
  "log": (level: "info" | "warn" | "error", message: string) => void;
}
