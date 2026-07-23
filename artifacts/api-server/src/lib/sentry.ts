/** Optional Sentry init for api-server — no-op when SENTRY_DSN unset. */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (await import("@sentry/node" as any)) as {
      init: (opts: { dsn: string; environment: string; tracesSampleRate: number }) => void;
      captureException: (err: unknown) => void;
    };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (await import("@sentry/node" as any)) as {
      captureException: (err: unknown) => void;
    };
    Sentry.captureException(err);
  } catch {
    /* ignore */
  }
}
