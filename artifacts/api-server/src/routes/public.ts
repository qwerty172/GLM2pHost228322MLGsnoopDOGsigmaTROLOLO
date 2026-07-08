import { Router, type IRouter } from "express";
import { and, desc, eq, gt, ilike, inArray, ne, sql } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// GET /public/games — public catalog with category/search/liveOnly filters.
// Mirrors the per-game aggregate data from /games but is explicitly mounted
// under /public so the task contract is satisfied.
// ---------------------------------------------------------------------------
router.get("/public/games", async (req, res): Promise<void> => {
  const category = (req.query.category as string | undefined)?.trim() ?? "";
  const search = (req.query.search as string | undefined)?.trim() ?? "";
  const liveOnly = req.query.liveOnly === "true" || req.query.liveOnly === "1";

  const conds: ReturnType<typeof eq>[] = [];
  if (category) conds.push(eq(gamesTable.category, category) as any);
  if (search) conds.push(ilike(gamesTable.title, `%${search}%`) as any);

  const games = await db
    .select({
      id: gamesTable.id,
      slug: gamesTable.slug,
      title: gamesTable.title,
      coverImageUrl: gamesTable.coverImageUrl,
      description: gamesTable.description,
      genre: gamesTable.genre,
      category: gamesTable.category,
      genres: gamesTable.genres,
      steamAppId: gamesTable.steamAppId,
      hasMods: gamesTable.hasMods,
      isMultiplayer: gamesTable.isMultiplayer,
      hostSpectatesPlayer: gamesTable.hostSpectatesPlayer,
      hasQuests: gamesTable.hasQuests,
      browserHostUrl: gamesTable.browserHostUrl,
    })
    .from(gamesTable)
    .where(conds.length > 0 ? and(...(conds as any)) : undefined)
    .orderBy(gamesTable.title);

  // Count live sessions per game via title match (backward compat).
  const liveSessions = await db
    .select({ appName: sessionsTable.appName, n: sql<number>`count(*)::int` })
    .from(sessionsTable)
    .where(ne(sessionsTable.status, "ended"))
    .groupBy(sessionsTable.appName);
  const liveMap = new Map<string, number>();
  for (const r of liveSessions) liveMap.set(r.appName.toLowerCase(), Number(r.n));

  const shaped = games
    .map((g) => ({
      ...g,
      liveSessionCount: liveMap.get(g.title.toLowerCase()) ?? 0,
    }))
    .filter((g) => (liveOnly ? g.liveSessionCount > 0 : true));

  res.json(shaped);
});

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
      // Host-to-server RTT measured at last heartbeat (null until first measurement).
      pingMs: h.pingMs ?? null,
    });
  }

  // We extend the response with a `games[]` field per host that isn't in the
  // generated schema yet. Return raw JSON — clients get backward-compat extra
  // fields and won't break. Strict schema parse would strip the new field.
  res.json(items);
});

// ---------------------------------------------------------------------------
// GET /public/games/:slug/hosts — hosts that have this game enabled in their
// library, with pricing from host_games and live-session status.
// Sorted: online first (have an active session for this game), then by price.
// ---------------------------------------------------------------------------
router.get("/public/games/:slug/hosts", async (req, res): Promise<void> => {
  const slug = (req.params.slug ?? "").trim();
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  const [game] = await db
    .select({ id: gamesTable.id, title: gamesTable.title })
    .from(gamesTable)
    .where(eq(gamesTable.slug, slug));

  if (!game) { res.status(404).json({ error: "Game not found" }); return; }

  // All enabled library entries for this game.
  const libraryRows = await db
    .select({
      hg: hostGamesTable,
      host: hostsTable,
    })
    .from(hostGamesTable)
    .innerJoin(hostsTable, eq(hostGamesTable.hostId, hostsTable.id))
    .where(
      and(
        eq(hostGamesTable.gameId, game.id),
        eq(hostGamesTable.enabled, true),
      ),
    )
    .orderBy(hostGamesTable.pricePerMinuteLzt);

  if (libraryRows.length === 0) { res.json([]); return; }

  const hostIds = libraryRows.map((r) => r.host.id);

  // Active sessions for these hosts tied to this specific game.
  const sessionRows = await db
    .select({
      hostId: sessionsTable.hostId,
      playerToken: sessionsTable.playerToken,
      status: sessionsTable.status,
    })
    .from(sessionsTable)
    .where(
      and(
        ne(sessionsTable.status, "ended"),
        eq(sessionsTable.gameId, game.id),
        inArray(sessionsTable.hostId, hostIds),
      ),
    );

  const sessionByHost = new Map<string, string>();
  for (const s of sessionRows) {
    if (!sessionByHost.has(s.hostId)) sessionByHost.set(s.hostId, s.playerToken);
  }

  const now = new Date();
  const result = libraryRows.map(({ hg, host: h }) => {
    const playerToken = sessionByHost.get(h.id) ?? null;
    const available = isHostAvailableNow(
      h.scheduleMode,
      h.scheduleJson ?? [],
      now,
    );
    return {
      hostId: h.id,
      displayName: h.displayName,
      tags: h.tags ?? [],
      description: h.description,
      pricePerMinuteLzt: hg.pricePerMinuteLzt,
      pricePerMinuteUsd: hg.pricePerMinuteLzt / 200,
      status: playerToken ? "online" : (available ? "available" : "scheduled"),
      playerToken,
      scheduleMode: h.scheduleMode,
      // Host-to-server RTT measured at last heartbeat (null until first measurement).
      pingMs: h.pingMs ?? null,
    };
  });

  // Sort: online > available > scheduled, then by price asc.
  const statusOrder = { online: 0, available: 1, scheduled: 2 };
  result.sort(
    (a, b) =>
      (statusOrder[a.status as keyof typeof statusOrder] ?? 2) -
      (statusOrder[b.status as keyof typeof statusOrder] ?? 2) ||
      a.pricePerMinuteLzt - b.pricePerMinuteLzt,
  );

  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /public/sessions — player-side session request.
//
// The player supplies { hostId, gameId? }. We look up the host's active
// non-ended session (optionally filtered by gameId) and return its
// playerToken so the caller can navigate to /play/:playerToken.
//
// Error codes:
//   409 — host_busy: host has an active session but it's already occupied
//         by another player (playerToken is being actively used). Currently
//         we surface this as the signaling-layer rejection; here we optimise
//         for returning 503 "not online for this game" until we track
//         occupancy at the DB layer.
//   503 — host not online for the requested game (no matching session).
//   404 — hostId not found.
// ---------------------------------------------------------------------------
router.post("/public/sessions", async (req, res): Promise<void> => {
  const hostId = (req.body?.hostId as string | undefined)?.trim() ?? "";
  const gameId = (req.body?.gameId as string | undefined)?.trim() ?? "";

  if (!hostId) {
    res.status(400).json({ error: "hostId required" });
    return;
  }

  // Verify host exists.
  const [host] = await db
    .select({ id: hostsTable.id })
    .from(hostsTable)
    .where(eq(hostsTable.id, hostId));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  // Find the best active session for this host, preferring the requested game.
  const conditions = [
    ne(sessionsTable.status, "ended"),
    eq(sessionsTable.hostId, hostId),
  ] as ReturnType<typeof eq>[];

  if (gameId) {
    conditions.push(eq(sessionsTable.gameId, gameId) as any);
  }

  const sessions = await db
    .select({
      playerToken: sessionsTable.playerToken,
      status: sessionsTable.status,
    })
    .from(sessionsTable)
    .where(and(...(conditions as any)))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(1);

  if (sessions.length === 0) {
    if (gameId) {
      // Try without game filter — maybe host is online for a different game.
      const fallbackSessions = await db
        .select({ playerToken: sessionsTable.playerToken })
        .from(sessionsTable)
        .where(
          and(
            ne(sessionsTable.status, "ended"),
            eq(sessionsTable.hostId, hostId),
          ),
        )
        .orderBy(desc(sessionsTable.createdAt))
        .limit(1);

      if (fallbackSessions.length > 0) {
        // Host is online but not for the requested game.
        res.status(409).json({ error: "host_busy", reason: "game_unavailable" });
        return;
      }
    }
    res.status(503).json({ error: "host_offline" });
    return;
  }

  res.json({ playerToken: sessions[0].playerToken });
});

// ---------------------------------------------------------------------------
// GET /public/ice-config — ICE server config for WebRTC (STUN + optional TURN)
// TURN credentials are read from env vars so they never appear in client code.
// ---------------------------------------------------------------------------
router.get("/public/ice-config", (_req, res): void => {
  type IceServer = { urls: string; username?: string; credential?: string };
  const iceServers: IceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];

  const turnUrl = process.env["TURN_URL"];
  const turnUsername = process.env["TURN_USERNAME"];
  const turnCredential = process.env["TURN_CREDENTIAL"];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  res.json({ iceServers });
});

// ---------------------------------------------------------------------------
// GET /public/ping — tiny latency probe for browser-side RTT measurement.
// No auth required. Returns immediately so the client can measure round-trip.
// ---------------------------------------------------------------------------
router.get("/public/ping", (_req, res): void => {
  res.json({ ok: true });
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
