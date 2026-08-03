import { lt, eq, and, inArray, notInArray } from "drizzle-orm";
import { db, sessionsTable, hostsTable, hostGamesTable } from "@workspace/db";
import { logger } from "./logger";
import {
  countSessionMinutesUsed,
  refundBlockRemainder,
} from "./sessionBilling";

const HEALTH_INTERVAL_MS = 30_000;

// Session timeout: end active sessions after host misses this many ms of heartbeats.
const HOST_TIMEOUT_MS = 60_000;

// Library timeout: delete host_games entries when host has been offline this long.
// Must be longer than HOST_TIMEOUT_MS so sessions are always ended first.
// Overridable via HOST_LIBRARY_TIMEOUT_MS env var (ms).
const LIBRARY_TIMEOUT_MS = (() => {
  const raw = process.env.HOST_LIBRARY_TIMEOUT_MS;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > HOST_TIMEOUT_MS
    ? parsed
    : 5 * 60_000; // default 5 minutes
})();

let interval: NodeJS.Timeout | null = null;
// Overlap guard: skip a tick if the previous check is still running.
let isChecking = false;

async function healthCheck(): Promise<void> {
  if (isChecking) return;
  isChecking = true;
  try {
    await sessionCheck();
    await libraryCleanup();
  } finally {
    isChecking = false;
  }
}

// ── 1. End stale active/pending sessions ────────────────────────────────────

/** Session statuses cleaned up when the host agent stops heartbeating. */
export const STALE_SESSION_STATUSES = ["active", "pending"] as const;

async function sessionCheck(): Promise<void> {
  const cutoff = new Date(Date.now() - HOST_TIMEOUT_MS);

  // End every non-ended session for an offline host — including unclaimed
  // lobby sessions (no claimedByPlayerId / devKeyId). Those otherwise pin
  // host_busy forever because creation only checks status <> 'ended'.
  const staleSessions = await db
    .select({ session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(
      and(
        inArray(sessionsTable.status, [...STALE_SESSION_STATUSES]),
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
              inArray(sessionsTable.status, [...STALE_SESSION_STATUSES]),
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

// ── 2. Remove library entries for hosts that have been offline too long ──────
//
// When the host agent reconnects it calls POST /hosts/me/library/bulk-publish
// which re-registers the games it can stream, so deletions here are safe.

async function libraryCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - LIBRARY_TIMEOUT_MS);

  // Find hosts that have been offline past the library timeout AND still have
  // at least one host_games row (to avoid needless queries on already-clean hosts).
  const staleHosts = await db
    .selectDistinct({ hostId: hostGamesTable.hostId })
    .from(hostGamesTable)
    .innerJoin(hostsTable, eq(hostGamesTable.hostId, hostsTable.id))
    .where(lt(hostsTable.lastSeenAt, cutoff));

  if (staleHosts.length === 0) return;

  const staleHostIds = staleHosts.map((r) => r.hostId);

  // Guard: skip any host that still has a non-ended session (edge case where
  // session billing hasn't caught up yet — shouldn't happen in normal flow).
  const busyHosts = await db
    .selectDistinct({ hostId: sessionsTable.hostId })
    .from(sessionsTable)
    .where(
      and(
        inArray(sessionsTable.hostId, staleHostIds),
        // anything that isn't "ended" counts as in-progress
        notInArray(sessionsTable.status, ["ended"]),
      ),
    );

  const busyHostIds = new Set(busyHosts.map((r) => r.hostId));
  const safeToClean = staleHostIds.filter((id) => !busyHostIds.has(id));

  if (safeToClean.length === 0) return;

  // Delete library entries for offline hosts.
  const deleted = await db
    .delete(hostGamesTable)
    .where(inArray(hostGamesTable.hostId, safeToClean))
    .returning({ id: hostGamesTable.id, hostId: hostGamesTable.hostId });

  if (deleted.length > 0) {
    logger.info(
      {
        removedEntries: deleted.length,
        affectedHosts: safeToClean.length,
        hostIds: safeToClean,
        libraryTimeoutMs: LIBRARY_TIMEOUT_MS,
      },
      "Removed host library entries — host offline with no heartbeat",
    );
  }
}

export function startHostHealthWorker(): void {
  if (interval) return;
  logger.info(
    {
      intervalMs: HEALTH_INTERVAL_MS,
      sessionTimeoutMs: HOST_TIMEOUT_MS,
      libraryTimeoutMs: LIBRARY_TIMEOUT_MS,
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
