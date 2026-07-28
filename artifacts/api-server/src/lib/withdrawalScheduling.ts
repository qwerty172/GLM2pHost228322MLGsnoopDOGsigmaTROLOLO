const MAX_BACKOFF_MS = Number(
  process.env["WALLET_WITHDRAW_MAX_BACKOFF_MS"] ?? 30 * 60_000,
);
const STUCK_PROCESSING_MS = Number(
  process.env["WALLET_WITHDRAW_STUCK_MS"] ?? 15 * 60_000,
);

export function withdrawalBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  const base = 60_000;
  return Math.min(base * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

export function isWithdrawalReadyForRetry(
  row: {
    status: string;
    attempts: number;
    requestedAt: Date;
    processingAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (row.status === "processing") {
    if (!row.processingAt) return true;
    return now.getTime() - row.processingAt.getTime() >= STUCK_PROCESSING_MS;
  }
  if (row.status !== "pending") return false;
  const waitMs = withdrawalBackoffMs(row.attempts);
  return now.getTime() - row.requestedAt.getTime() >= waitMs;
}

export { STUCK_PROCESSING_MS };
