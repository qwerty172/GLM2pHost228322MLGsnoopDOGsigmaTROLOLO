import type { PlatformEvent } from "./pgNotify";

const SENSITIVE_KEYS = new Set([
  "player_token",
  "invite_code",
  "host_token",
]);

/** Strip secrets from NOTIFY row payloads before they reach SSE clients. */
export function redactEventPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/** True when an event belongs to the authenticated host's dashboard stream. */
export function isEventForHost(
  event: PlatformEvent,
  hostId: string,
): boolean {
  const payload = event.payload;
  const sessionHostId = payload.host_id ?? payload.hostId;
  if (typeof sessionHostId === "string" && sessionHostId === hostId) {
    return true;
  }
  const hostRowId = payload.id;
  if (typeof hostRowId === "string" && hostRowId === hostId) {
    return true;
  }
  return false;
}

export function filterEventForHost(
  event: PlatformEvent,
  hostId: string,
): PlatformEvent | null {
  if (!isEventForHost(event, hostId)) return null;
  return {
    ...event,
    payload: redactEventPayload(event.payload),
  };
}
