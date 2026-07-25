import { useEffect } from "react";
import type { PlatformEvent } from "@/lib/platform-events-types";

/** Subscribe to platform SSE events (Postgres NOTIFY fan-out). */
export function usePlatformEvents(
  onEvent: (event: PlatformEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const url = `${import.meta.env.BASE_URL}api/events/stream`;
    const es = new EventSource(url);
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as PlatformEvent;
        if (event.type !== "connected") onEvent(event);
      } catch {
        /* ignore malformed */
      }
    };
    return () => es.close();
  }, [onEvent, enabled]);
}
