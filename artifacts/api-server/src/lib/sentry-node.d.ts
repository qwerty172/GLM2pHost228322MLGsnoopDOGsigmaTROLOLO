/** Ambient types for optional runtime dependency @sentry/node */
declare module "@sentry/node" {
  export function init(opts: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  }): void;
  export function captureException(err: unknown): void;
}
