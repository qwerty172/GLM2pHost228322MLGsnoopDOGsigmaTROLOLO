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
  ratePerMinute: number;
  resolution: { width: number; height: number };
  bitrateKbps: number;
  killAppOnDisconnect: boolean;
  autoLaunchAtStartup: boolean;
}

export type InputEvent =
  | { kind: "mousemove"; x: number; y: number }
  | { kind: "mousedown"; button: "left" | "right" | "middle" }
  | { kind: "mouseup"; button: "left" | "right" | "middle" }
  | { kind: "wheel"; deltaY: number }
  | { kind: "keydown"; code: string; key: string }
  | { kind: "keyup"; code: string; key: string };

export interface IpcChannels {
  "config:get": () => HostConfig | null;
  "config:set": (config: HostConfig) => HostConfig;
  "status:set": (status: AgentStatus, message?: string) => void;
  "input:inject": (event: InputEvent) => void;
  "app:launch": () => { ok: boolean; pid?: number; error?: string };
  "app:kill": () => void;
  "log": (level: "info" | "warn" | "error", message: string) => void;
}
