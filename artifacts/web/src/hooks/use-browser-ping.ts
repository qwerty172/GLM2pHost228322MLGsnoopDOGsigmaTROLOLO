import { useEffect, useState } from "react";
import { publicPing } from "@workspace/api-client-react";

export const BROWSER_PING_INTERVAL_MS = 60_000;

/** Measure one RTT sample; returns null when the ping fails. */
export async function probeBrowserPingMs(
  ping: () => Promise<unknown> = publicPing,
): Promise<number | null> {
  try {
    const t0 = Date.now();
    await ping();
    return Date.now() - t0;
  } catch {
    return null;
  }
}

/** Browser RTT to the platform API — re-probed every 60s while mounted. */
export function useBrowserPingMs(): number | null {
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function probe() {
      const ms = await probeBrowserPingMs();
      if (ms !== null && !cancelled) setPingMs(ms);
    }

    void probe();
    timer = setInterval(() => void probe(), BROWSER_PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return pingMs;
}
