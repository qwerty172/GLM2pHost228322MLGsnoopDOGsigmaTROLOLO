/** Sentry is optional — stub when package is not installed. */
export async function initSentry(): Promise<void> {
  // No-op: @sentry/react is not installed.
  // Set VITE_SENTRY_DSN and install @sentry/react to enable error reporting.
}
