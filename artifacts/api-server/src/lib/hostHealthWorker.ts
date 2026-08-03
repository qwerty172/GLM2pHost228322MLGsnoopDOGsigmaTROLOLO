import { lt, eq, and, isNotNull, or } from "drizzle-orm";
import { db, sessionsTable, hostsTable } from "@workspace/db";
import { logger } from "./logger";
import {
  countSessionMinutesUsed,
  refundBlockRemainder,
} from "./sessionBilling";

const HEALTH_INTERVAL_MS = 30_000;

// Session timeout: end active sessions after host misses this many ms of heartbeats.
const HOST_TIMEOUT_MS = 60_000;

let interval: NodeJS.Timeout | null = null;
// Overlap guard: skip a tick if the previous check is still running.
let isChecking = false;

async function healthCheck(): Promise<void> {
  if (isChecking) return;
  isChecking = true;
  try {
    await sessionCheck();
  } finally {
    isChecking = false;
  }
}

// ── 1. End stale active sessions ────────────────────────────────────────────

async function sessionCheck(): Promise<void> {
  const cutoff = new Date(Date.now() - HOST_TIMEOUT_MS);

  // Include embed/dev-key sessions — they have no claimedByPlayerId but still
  // burn the host while the agent is offline.
  const staleSessions = await db
    .select({ session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(
      and(
        eq(sessionsTable.status, "active"),
        or(
          isNotNull(sessionsTable.claimedByPlayerId),
          isNotNull(sessionsTable.devKeyId),
        ),
        lt(hostsTable.lastSeenAt, cutoff),
      ),
    );

  if (staleSessions.length === 0) return;

  const now = new Date();
  const ids: string[] = [];

  for (const { session } of staleSessions) {
    try {
      await db.transaction(async (tx) => {
        // Claim end: only transition active → ended once.
        const ended = await tx
          .update(sessionsTable)
          .set({ status: "ended", endedAt: now, endReason: "host_offline" })
          .where(
            and(
              eq(sessionsTable.id, session.id),
              eq(sessionsTable.status, "active"),
            ),
          )
          .returning({ id: sessionsTable.id });
        if (ended.length === 0) return;

        if (
          session.blockMinutes &&
          session.blockReservedLzt &&
          session.claimedByPlayerId
        ) {
          const minutesUsed = await countSessionMinutesUsed(tx, session.id);
          await refundBlockRemainder(tx, session, minutesUsed);
        }
      });
      ids.push(session.id);
    } catch (err) {
      logger.error(
        { err, sessionId: session.id },
        "Failed to end stale session / refund block",
      );
    }
  }

  if (ids.length > 0) {
    logger.warn(
      { count: ids.length, sessionIds: ids },
      "Terminated stale sessions — host offline (no heartbeat for >60s)",
    );
  }
}

export function startHostHealthWorker(): void {
  if (interval) return;
  logger.info(
    {
      intervalMs: HEALTH_INTERVAL_MS,
      sessionTimeoutMs: HOST_TIMEOUT_MS,
    },
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
