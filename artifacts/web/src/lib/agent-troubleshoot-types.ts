export type AudioMode = "off" | "voice" | "standard" | "quality";

export type AgentState =
  | { status: "checking" }
  | { status: "online"; version: string; audioMode: AudioMode; port: number }
  | { status: "offline" };

export type HeartbeatState =
  | { status: "unknown" }
  | { status: "fresh"; lastSeenAt: string }
  | { status: "stale"; lastSeenAt: string }
  | { status: "never" };
