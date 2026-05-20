import { Router, type IRouter } from "express";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import {
  db,
  gamesTable,
  hostGamesTable,
  hostsTable,
  sessionsTable,
  billingEventsTable,
  withdrawalsTable,
} from "@workspace/db";
import {
  ListPublicHostsResponse,
  GetPublicStatsResponse,
} from "@workspace/api-zod";
import { isHostAvailableNow } from "../lib/schedule";

const router: IRouter = Router();

function urlHostname(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Public, anonymous-safe list of hosts currently offering a session.
// A "live" host is one with at least one non-ended session and whose schedule
// says it's open right now. We surface only display-safe fields.
// Each host now includes a `games[]` array from their multi-game library so
// the player-facing catalog can show what a host offers without a separate call.
router.get("/hosts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      session: sessionsTable,
      host: hostsTable,
    })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(ne(sessionsTable.status, "ended"))
    .orderBy(desc(sessionsTable.createdAt));

  const now = new Date();
  const seen = new Set<string>();
  const liveHostIds: string[] = [];
  const hostMap = new Map<string, { host: typeof hostsTable.$inferSelect; session: typeof sessionsTable.$inferSelect }>();

  for (const { host: h, session: s } of rows) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    liveHostIds.push(h.id);
    hostMap.set(h.id, { host: h, session: s });
  }

  // Fetch enabled library entries for all live hosts in one query.
  const libraryRows =
    liveHostIds.length > 0
      ? await db
          .select({
            hg: hostGamesTable,
            game: {
              id: gamesTable.id,
              slug: gamesTable.slug,
              title: gamesTable.title,
              coverImageUrl: gamesTable.coverImageUrl,
              genre: gamesTable.genre,
            },
          })
          .from(hostGamesTable)
          .innerJoin(gamesTable, eq(hostGamesTable.gameId, gamesTable.id))
          .where(
            and(
              eq(hostGamesTable.enabled, true),
              inArray(hostGamesTable.hostId, liveHostIds),
            ),
          )
          .orderBy(hostGamesTable.sortOrder)
      : [];

  // Group library entries by hostId.
  const libraryByHost = new Map<string, Array<{
    gameId: string;
    slug: string;
    title: string;
    coverImageUrl: string;
    genre: string;
    pricePerMinuteLzt: number;
  }>>();
  for (const r of libraryRows) {
    const arr = libraryByHost.get(r.hg.hostId) ?? [];
    arr.push({
      gameId: r.hg.gameId,
      slug: r.game.slug,
      title: r.game.title,
      coverImageUrl: r.game.coverImageUrl,
      genre: r.game.genre,
      pricePerMinuteLzt: r.hg.pricePerMinuteLzt,
    });
    libraryByHost.set(r.hg.hostId, arr);
  }

  const items = [];
  for (const hostId of liveHostIds) {
    const entry = hostMap.get(hostId);
    if (!entry) continue;
    const { host: h, session: s } = entry;
    const available = isHostAvailableNow(
      h.scheduleMode,
      h.scheduleJson ?? [],
      now,
    );
    const minutePrice = Number(h.minutePriceUsd);
    const games = libraryByHost.get(h.id) ?? [];

    items.push({
      id: h.id,
      displayName: h.displayName,
      // Deprecated single-game fields kept for backward compat with old clients.
      boundAppLabel: h.boundAppLabel || s.appName,
      boundUrlHost: urlHostname(h.boundUrl),
      tags: h.tags ?? [],
      pricePerHourUsd: Number.isFinite(minutePrice) ? minutePrice * 60 : 0,
      launchPriceUsd: Number(h.launchPriceUsd),
      minutePriceUsd: minutePrice,
      status: available ? "online" : "scheduled",
      playerToken: s.playerToken,
      // New: multi-game library entries for this host.
      games,
    });
  }

  // We extend the response with a `games[]` field per host that isn't in the
  // generated schema yet. Return raw JSON — clients get backward-compat extra
  // fields and won't break. Strict schema parse would strip the new field.
  res.json(items);
});

// Platform stats for the public landing hero strip. Cheap aggregate queries —
// safe to call on every page-load (we don't cache today).
router.get("/stats", async (_req, res): Promise<void> => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  // "Hosts online" = hosts whose agent has phoned home within the last 5 min,
  // OR which currently have an active session. This is forgiving for the
  // early stage where many hosts may not yet maintain a live heartbeat.
  const [{ count: liveByHeartbeat }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hostsTable)
    .where(gt(hostsTable.lastSeenAt, fiveMinAgo));

  const [{ count: liveBySession }] = await db
    .select({
      count: sql<number>`count(distinct ${sessionsTable.hostId})::int`,
    })
    .from(sessionsTable)
    .where(ne(sessionsTable.status, "ended"));

  // Active sessions = pending or active (not ended).
  const [{ count: activeSessions }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(and(ne(sessionsTable.status, "ended")));

  // Total paid out = sum of completed host withdrawals, in cents. We round
  // because withdrawal amounts are stored with 6-decimal precision.
  const [{ totalCents }] = await db
    .select({
      totalCents: sql<number>`coalesce(round(sum(${withdrawalsTable.amount}) * 100)::int, 0)`,
    })
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.ownerType, "host"),
        eq(withdrawalsTable.status, "completed"),
      ),
    );

  // Fallback: if no withdrawals yet, show lifetime host credit accrued —
  // gives early visitors a non-zero figure that still reflects real activity.
  let paidCents = Number(totalCents) || 0;
  if (paidCents === 0) {
    const [{ accrued }] = await db
      .select({
        // hostCreditLzt is integer LZT (200 LZT = 1 USDT = 100¢), so cents = sum/2.
        accrued: sql<number>`coalesce(round(sum(${billingEventsTable.hostCreditLzt}) / 2.0)::int, 0)`,
      })
      .from(billingEventsTable);
    paidCents = Number(accrued) || 0;
  }

  res.json(
    GetPublicStatsResponse.parse({
      hostsOnline: Math.max(
        Number(liveByHeartbeat) || 0,
        Number(liveBySession) || 0,
      ),
      activeSessions: Number(activeSessions) || 0,
      totalPaidOutCents: paidCents,
    }),
  );
});

export default router;
