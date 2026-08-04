/** Optional Sentry init for api-server — no-op when SENTRY_DSN unset. */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
    });
  } catch {
    /* optional dependency */
  }
}

export async function captureException(err: unknown): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.captureException(err);
  } catch {
    /* ignore */
  }
}
