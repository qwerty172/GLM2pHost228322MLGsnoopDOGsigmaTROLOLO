import { lt, eq, and, inArray, isNotNull, or, notInArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
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

const STALE_SESSION_STATUSES = ["active", "pending"] as const;

async function endStaleSession(
  session: InferSelectModel<typeof sessionsTable>,
  now: Date,
): Promise<boolean> {
  let ended = false;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(sessionsTable)
      .set({ status: "ended", endedAt: now, endReason: "host_offline" })
      .where(
        and(
          eq(sessionsTable.id, session.id),
          inArray(sessionsTable.status, [...STALE_SESSION_STATUSES]),
        ),
      )
      .returning();
    if (!row) return;
    ended = true;

    if (
      row.blockMinutes &&
      row.blockReservedLzt &&
      row.claimedByPlayerId
    ) {
      const minutesUsed = await countSessionMinutesUsed(tx, row.id);
      await refundBlockRemainder(tx, row, minutesUsed);
    }
  });
  return ended;
}

async function sessionCheck(): Promise<void> {
  const cutoff = new Date(Date.now() - HOST_TIMEOUT_MS);

  // Include embed/dev-key sessions — they have no claimedByPlayerId but still
  // burn the host while the agent is offline. Pending sessions are included
  // too: a player can claim before WebRTC connects, leaving the host slot
  // locked indefinitely if we only watched active sessions.
  const staleSessions = await db
    .select({ session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(
      and(
        inArray(sessionsTable.status, [...STALE_SESSION_STATUSES]),
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
      if (await endStaleSession(session, now)) {
        ids.push(session.id);
      }
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
