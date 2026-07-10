import { lt, eq, and, inArray, isNotNull } from "drizzle-orm";
import { db, sessionsTable, hostsTable } from "@workspace/db";
import { logger } from "./logger";

const HEALTH_INTERVAL_MS = 30_000;
const HOST_TIMEOUT_MS = 60_000;
let interval: NodeJS.Timeout | null = null;
// Overlap guard: skip a tick if the previous check is still running.
let isChecking = false;

async function healthCheck(): Promise<void> {
  if (isChecking) return;
  isChecking = true;
  try {
    await healthCheckInner();
  } finally {
    isChecking = false;
  }
}

async function healthCheckInner(): Promise<void> {
  const cutoff = new Date(Date.now() - HOST_TIMEOUT_MS);

  const staleSessions = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(
      and(
        eq(sessionsTable.status, "active"),
        isNotNull(sessionsTable.claimedByPlayerId),
        lt(hostsTable.lastSeenAt, cutoff),
      ),
    );

  if (staleSessions.length === 0) return;

  const ids = staleSessions.map((s) => s.id);
  const now = new Date();
  await db
    .update(sessionsTable)
    .set({ status: "ended", endedAt: now, endReason: "host_offline" })
    .where(inArray(sessionsTable.id, ids));

  logger.warn(
    { count: ids.length, sessionIds: ids },
    "Terminated stale sessions — host offline (no heartbeat for >60s)",
  );
}

export function startHostHealthWorker(): void {
  if (interval) return;
  logger.info(
    { intervalMs: HEALTH_INTERVAL_MS, timeoutMs: HOST_TIMEOUT_MS },
    "Starting host health worker",
  );
  interval = setInterval(() => {
    void healthCheck().catch((err) => {
      logger.error({ err }, "Host health check failed");
    });
  }, HEALTH_INTERVAL_MS);
}

export function stopHostHealthWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
