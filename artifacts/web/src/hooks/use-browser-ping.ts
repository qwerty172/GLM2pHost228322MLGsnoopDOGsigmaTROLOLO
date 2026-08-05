import { useEffect, useState } from "react";
import { publicPing } from "@workspace/api-client-react";

export const PING_INTERVAL_MS = 60_000;

/** Measure RTT to the platform API (ms). Injectable ping for tests. */
export async function probeBrowserPingMs(
  ping: () => Promise<unknown> = publicPing,
): Promise<number> {
  const t0 = Date.now();
  await ping();
  return Date.now() - t0;
}

/** Browser RTT to the platform API — re-probed every 60s while mounted. */
export function useBrowserPingMs(): number | null {
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function probe() {
      try {
        const ms = await probeBrowserPingMs();
        if (!cancelled) setPingMs(ms);
      } catch {
        /* ignore */
      }
    }

    void probe();
    timer = setInterval(() => void probe(), PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return pingMs;
}
