import { useEffect } from "react";
import type { PlatformEvent } from "@/lib/platform-events-types";

export function buildPlatformEventsStreamUrl(baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl}api/events/stream`;
}

/** Parse SSE payload; returns null for handshake or malformed messages. */
export function parsePlatformEventMessage(data: string): PlatformEvent | null {
  try {
    const event = JSON.parse(data) as PlatformEvent;
    if (event.type === "connected") return null;
    return event;
  } catch {
    return null;
  }
}

/** Subscribe to platform SSE events (Postgres NOTIFY fan-out). */
export function usePlatformEvents(
  onEvent: (event: PlatformEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const url = buildPlatformEventsStreamUrl();
    const es = new EventSource(url);
    es.onmessage = (msg) => {
      const event = parsePlatformEventMessage(msg.data);
      if (event) onEvent(event);
    };
    return () => es.close();
  }, [onEvent, enabled]);
}
