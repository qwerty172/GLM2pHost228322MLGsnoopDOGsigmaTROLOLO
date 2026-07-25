/** Optional Sentry init — no-op when SENTRY_DSN is unset. */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry = (await import("@sentry/react" as any)) as {
      init: (opts: { dsn: string; environment: string; tracesSampleRate: number }) => void;
    };
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
    });
  } catch {
    /* package optional in dev */
  }
}
