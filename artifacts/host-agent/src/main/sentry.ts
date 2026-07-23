/** Optional Sentry init for Electron main — no-op when SENTRY_DSN unset. */
export function initSentryMain(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = require("@sentry/electron/main" as any) as {
      init: (opts: { dsn: string; environment: string }) => void;
    };
    Sentry.init({ dsn, environment: process.env.NODE_ENV ?? "production" });
  } catch {
    /* optional dependency */
  }
}
