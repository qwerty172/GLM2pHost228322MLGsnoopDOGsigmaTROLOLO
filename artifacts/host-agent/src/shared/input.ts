// Shared InputEvent parsing for ping-server, IPC handlers, and DataChannel.

import type { InputEvent, GamepadState } from "./messages";

const VALID_INPUT_KINDS = new Set([
  "mousemove",
  "mousedown",
  "mouseup",
  "wheel",
  "keydown",
  "keyup",
]);

/** Well-known local secret for browser-play → agent POST /input (localhost only). */
export const LOCAL_INPUT_SECRET = "dh-local-input-v1";

/** Header name required on POST /input. */
export const INPUT_SECRET_HEADER = "x-agent-input-secret";

export function parseInputEvent(raw: unknown): InputEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj["kind"];
  if (typeof kind !== "string" || !VALID_INPUT_KINDS.has(kind)) return null;
  if (kind === "mousemove") {
    if (typeof obj["x"] !== "number" || typeof obj["y"] !== "number") return null;
    if (!Number.isFinite(obj["x"]) || !Number.isFinite(obj["y"])) return null;
    const mode = obj["mode"];
    if (mode !== undefined && mode !== "absolute" && mode !== "relative") return null;
    return {
      kind: "mousemove",
      x: obj["x"],
      y: obj["y"],
      ...(mode === "relative" || mode === "absolute" ? { mode } : {}),
    };
  }
  if (kind === "mousedown" || kind === "mouseup") {
    if (obj["button"] !== "left" && obj["button"] !== "right" && obj["button"] !== "middle") {
      return null;
    }
    return { kind, button: obj["button"] };
  }
  if (kind === "wheel") {
    if (typeof obj["deltaY"] !== "number" || !Number.isFinite(obj["deltaY"])) return null;
    return { kind: "wheel", deltaY: obj["deltaY"] };
  }
  if (kind === "keydown" || kind === "keyup") {
    if (typeof obj["code"] !== "string" || typeof obj["key"] !== "string") return null;
    if (obj["code"].length > 64 || obj["key"].length > 64) return null;
    return { kind, code: obj["code"], key: obj["key"] };
  }
  return null;
}

export function parseGamepadState(raw: unknown): GamepadState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj["axes"]) || !Array.isArray(obj["buttons"])) return null;
  if (obj["axes"].length > 16 || obj["buttons"].length > 32) return null;
  const axes = obj["axes"].map((v) =>
    Math.max(-1, Math.min(1, typeof v === "number" && Number.isFinite(v) ? v : 0)),
  );
  const buttons = obj["buttons"].map((v) => (v ? 1 : 0));
  return { axes, buttons };
}

/** Validate a partial HostConfig patch from IPC. */
export function parseHostConfigPatch(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "object" || raw === null) return null;
  return raw as Record<string, unknown>;
}
