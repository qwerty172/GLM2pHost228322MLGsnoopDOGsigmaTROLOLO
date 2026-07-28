import { useEffect } from "react";
import type { PlatformEvent } from "@/lib/platform-events-types";

const HOST_TOKEN_KEY = "streamline.hostToken";

/** Subscribe to platform SSE events (Postgres NOTIFY fan-out). Requires host token. */
export function usePlatformEvents(
  onEvent: (event: PlatformEvent) => void,
  enabled = true,
  hostToken?: string | null,
): void {
  useEffect(() => {
    if (!enabled) return;
    const token =
      hostToken?.trim() ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem(HOST_TOKEN_KEY)?.trim()
        : null);
    if (!token) return;

    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const url = `${base}/api/events/stream?hostToken=${encodeURIComponent(token)}`;
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
  }, [onEvent, enabled, hostToken]);
}
