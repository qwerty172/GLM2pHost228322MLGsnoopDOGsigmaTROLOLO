import { useEffect, useState } from "react";

const PING_INTERVAL_MS = 60_000;

/** Browser RTT to the platform API — re-probed every 60s while mounted. */
export function useBrowserPingMs(): number | null {
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function probe() {
      try {
        const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
        const t0 = Date.now();
        await fetch(`${base}/api/public/ping`, { cache: "no-store" });
        if (!cancelled) setPingMs(Date.now() - t0);
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
