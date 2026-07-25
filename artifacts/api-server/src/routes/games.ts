import { Router, type IRouter } from "express";
import { and, eq, ilike, ne, sql, or, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { db, gamesTable, hostGamesTable, hostsTable, sessionsTable } from "@workspace/db";
import {
  GetGameBySlugParams,
  GetGameBySlugResponse,
  ListGamesResponse,
} from "@workspace/api-zod";
import { isHostAvailableNow } from "../lib/schedule";

// Resolve the admin host id from the X-Host-Token header, or return null.
async function resolveAdminId(
  req: import("express").Request,
): Promise<string | null> {
  const token = req.headers["x-host-token"];
  if (!token) return null;
  const t = Array.isArray(token) ? token[0] : token;
  const [host] = await db
    .select({ id: hostsTable.id, isAdmin: hostsTable.isAdmin })
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, t));
  return host?.isAdmin ? host.id : null;
}

// Strict boolean coercion for URL query strings. The orval-generated
// schema uses `zod.coerce.boolean()`, which treats any non-empty string
// (including "false" and "0") as `true` — that would silently invert
// filter intent. We accept only the canonical literal forms.
const strictBool = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1")
  .optional();

const ListGamesQuery = z.object({
  hasMods: strictBool,
  isMultiplayer: strictBool,
  hostSpectatesPlayer: strictBool,
  hasQuests: strictBool,
  vdsOnly: strictBool,
  liveOnly: strictBool,
  search: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  includeHidden: strictBool,
});

const GetGameQuery = z.object({
  tag: z.string().optional(),
});

// Match any element of a jsonb string-array case-insensitively.
function tagMatchSql(needle: string) {
  return sql`exists (select 1 from jsonb_array_elements_text(${hostsTable.tags}) e where lower(e) = lower(${needle}))`;
}

const router: IRouter = Router();

type GameRow = typeof gamesTable.$inferSelect;

// Per-game aggregates from the host_games junction table.
type GameAggregates = {
  liveHostsCount: number;
  vdsHostsCount: number;
  minPricePerMinuteLzt: number | null;
};

function shapeGame(
  g: GameRow,
  liveSessionCount: number,
  agg?: GameAggregates,
) {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    coverImageUrl: g.coverImageUrl,
    description: g.description,
    genre: g.genre,
    // Extra catalog fields (not in generated Zod schema; bypass strict parse below).
    category: g.category,
    genres: g.genres,
    createdAt: g.createdAt,
    hasMods: g.hasMods,
    isMultiplayer: g.isMultiplayer,
    hostSpectatesPlayer: g.hostSpectatesPlayer,
    hasQuests: g.hasQuests,
    browserHostUrl: g.browserHostUrl,
    saveManifest: g.saveManifest ?? [],
    liveSessionCount,
    liveHostsCount: agg?.liveHostsCount ?? 0,
    vdsHostsCount: agg?.vdsHostsCount ?? 0,
    hasVdsHosts: (agg?.vdsHostsCount ?? 0) > 0,
    minPricePerMinuteLzt: agg?.minPricePerMinuteLzt ?? null,
  };
}

// Sessions don't have a hard FK to games yet (host agents free-text the
// app name today), so we count "live" sessions for a game by case-
// insensitive title match. This keeps the catalog useful before the
// host-agent integration lands.
async function liveCountsByTitle(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      appName: sessionsTable.appName,
      n: sql<number>`count(*)::int`,
    })
    .from(sessionsTable)
    .where(ne(sessionsTable.status, "ended"))
    .groupBy(sessionsTable.appName);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.appName.toLowerCase(), Number(r.n));
  }
  return map;
}

// Returns per-game live-host count and minimum LZT price from host_games.
// "Live" = the host has at least one active session (regardless of which
// game, for broad legacy compat) AND has the game enabled in their library.
async function gameAggregates(
  gameIds: string[],
): Promise<Map<string, GameAggregates>> {
  if (gameIds.length === 0) return new Map();

  // Active host set (any non-ended session).
  const activeSessions = await db
    .selectDistinct({ hostId: sessionsTable.hostId })
    .from(sessionsTable)
    .where(ne(sessionsTable.status, "ended"));
  const activeHostIds = new Set(activeSessions.map((r) => r.hostId));

  // Pull all enabled host_games entries for the requested games.
  const hgRows = await db
    .select({
      gameId: hostGamesTable.gameId,
      hostId: hostGamesTable.hostId,
      pricePerMinuteLzt: hostGamesTable.pricePerMinuteLzt,
      isVds: hostsTable.isVds,
    })
    .from(hostGamesTable)
    .innerJoin(hostsTable, eq(hostGamesTable.hostId, hostsTable.id))
    .where(
      and(
        eq(hostGamesTable.enabled, true),
        inArray(hostGamesTable.gameId, gameIds),
      ),
    );

  const map = new Map<string, GameAggregates>();
  for (const row of hgRows) {
    const isLive = activeHostIds.has(row.hostId);
    const isVds = row.isVds === 1;
    const cur = map.get(row.gameId) ?? {
      liveHostsCount: 0,
      vdsHostsCount: 0,
      minPricePerMinuteLzt: null,
    };
    if (isLive) cur.liveHostsCount += 1;
    if (isVds && isLive) cur.vdsHostsCount += 1;
    if (
      cur.minPricePerMinuteLzt === null ||
      row.pricePerMinuteLzt < cur.minPricePerMinuteLzt
    ) {
      cur.minPricePerMinuteLzt = row.pricePerMinuteLzt;
    }
    map.set(row.gameId, cur);
  }
  return map;
}

router.get("/games", async (req, res): Promise<void> => {
  const parsed = ListGamesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const q = parsed.data;

  // includeHidden=1 is only honoured for admins; everyone else always sees
  // only visible games.
  let showHidden = false;
  if (q.includeHidden === true) {
    const adminId = await resolveAdminId(req);
    if (adminId) showHidden = true;
  }

  const conds = [];
  // Filter hidden games unless admin explicitly requests them.
  // Non-admins also see only games that have a playable cover (non-empty
  // cover_image_url or browser_host_url). This drops placeholder stubs
  // that slipped past the is_hidden flag.
  if (!showHidden) {
    conds.push(eq(gamesTable.isHidden, false));
    conds.push(
      or(
        sql`${gamesTable.browserHostUrl} != ''`,
        sql`${gamesTable.coverImageUrl} != ''`,
      )!,
    );
  }
  if (q.hasMods === true) conds.push(eq(gamesTable.hasMods, true));
  if (q.isMultiplayer === true)
    conds.push(eq(gamesTable.isMultiplayer, true));
  if (q.hostSpectatesPlayer === true)
    conds.push(eq(gamesTable.hostSpectatesPlayer, true));
  if (q.hasQuests === true) conds.push(eq(gamesTable.hasQuests, true));
  if (q.search && q.search.trim().length > 0) {
    conds.push(ilike(gamesTable.title, `%${q.search.trim()}%`));
  }
  if (q.category && q.category.trim().length > 0) {
    conds.push(eq(gamesTable.category, q.category.trim()));
  }

  const games = await db
    .select()
    .from(gamesTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(gamesTable.title);

  const gameIds = games.map((g) => g.id);
  const [counts, aggs] = await Promise.all([
    liveCountsByTitle(),
    gameAggregates(gameIds),
  ]);

  let shaped = games.map((g) =>
    shapeGame(g, counts.get(g.title.toLowerCase()) ?? 0, aggs.get(g.id)),
  );
  if (q.liveOnly === true) {
    shaped = shaped.filter(
      (g) => g.liveSessionCount > 0 || g.liveHostsCount > 0,
    );
  }
  if (q.vdsOnly === true) {
    shaped = shaped.filter((g) => g.hasVdsHosts);
  }

  // Tag filter: keep only games that have at least one currently-available
  // host (active session, host-tags @>= [tag] case-insensitively, and host
  // is "open right now" per its schedule). We compute the matching set in a
  // single query and intersect.
  const tag = q.tag?.trim();
  if (tag && tag.length > 0) {
    const matchedHosts = await db
      .select({
        gameId: hostsTable.gameId,
        title: sessionsTable.appName,
        scheduleMode: hostsTable.scheduleMode,
        scheduleJson: hostsTable.scheduleJson,
      })
      .from(sessionsTable)
      .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
      .where(and(ne(sessionsTable.status, "ended"), tagMatchSql(tag)));
    const now = new Date();
    const liveGameIds = new Set<string>();
    const liveTitles = new Set<string>();
    for (const r of matchedHosts) {
      if (!isHostAvailableNow(r.scheduleMode, r.scheduleJson ?? [], now))
        continue;
      if (r.gameId) liveGameIds.add(r.gameId);
      if (r.title) liveTitles.add(r.title.toLowerCase());
    }
    shaped = shaped.filter(
      (g) => liveGameIds.has(g.id) || liveTitles.has(g.title.toLowerCase()),
    );
  }

  // Bypass strict Zod parse — we've added liveHostsCount and
  // minPricePerMinuteLzt which aren't in the generated schema yet.
  // Returning raw shaped preserves the new fields for the UI.
  res.json(shaped);
});

router.get("/games/:slug", async (req, res): Promise<void> => {
  const params = GetGameBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParsed = GetGameQuery.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: queryParsed.error.message });
    return;
  }
  const tagFilter = queryParsed.data.tag?.trim() ?? "";

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.slug, params.data.slug));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  // Hidden games are invisible to non-admins.
  if (game.isHidden) {
    const adminId = await resolveAdminId(req);
    if (!adminId) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
  }

  // A "live" host listing for this game requires an open session row. The
  // session can be associated with this game in two ways:
  //  (a) sessions.gameId matches (the new path via host library), or
  //  (b) its appName matches the game title (legacy free-text path), or
  //  (c) the host is explicitly bound via hosts.gameId (deprecated field).
  const sessionRows = await db
    .select({
      session: sessionsTable,
      host: hostsTable,
    })
    .from(sessionsTable)
    .innerJoin(hostsTable, eq(sessionsTable.hostId, hostsTable.id))
    .where(
      and(
        ne(sessionsTable.status, "ended"),
        or(
          // Primary: session's own game binding (set by new library path or backfill).
          eq(sessionsTable.gameId, game.id),
          // Legacy fallback: sessions created before gameId was tracked, matched by
          // appName. Only applies when sessions.gameId IS NULL to avoid false-positives
          // from multi-game hosts where hosts.gameId differs from sessions.gameId.
          and(
            sql`${sessionsTable.gameId} IS NULL`,
            ilike(sessionsTable.appName, game.title),
          ),
        ),
      ),
    )
    .orderBy(sessionsTable.createdAt);

  const now = new Date();
  const tagLc = tagFilter.toLowerCase();
  const shapedSessions = sessionRows
    .filter(({ host }) =>
      isHostAvailableNow(host.scheduleMode, host.scheduleJson ?? [], now),
    )
    .filter(({ host }) => {
      if (!tagLc) return true;
      const tags = host.tags ?? [];
      return tags.some((t) => t.toLowerCase() === tagLc);
    })
    .map(({ session: s, host: h }) => ({
      hostId: h.id,
      playerToken: s.playerToken,
      appName: s.appName,
      ratePerMinute: Number(s.ratePerMinute),
      // LZT price resolved from host_games when session was created;
      // fall back to deriving it from ratePerMinute for legacy sessions.
      pricePerMinuteLzt: Math.round(Number(s.ratePerMinute) * 200),
      resolution: s.resolution,
      bitrateKbps: s.bitrateKbps,
      status: s.status,
      createdAt: s.createdAt,
      hostDisplayName: h.displayName,
      boundAppLabel: h.boundAppLabel || s.appName,
      boundUrl: h.boundUrl ?? "",
      description: h.description,
      tags: h.tags ?? [],
      launchPriceUsd: Number(h.launchPriceUsd),
      minutePriceUsd: Number(h.minutePriceUsd),
      scheduleMode: h.scheduleMode,
      scheduleJson: h.scheduleJson ?? [],
      streamPlatform: h.streamPlatform,
      // Placeholders — ping and rating system land in a later task.
      pingMs: null as number | null,
      ratingScore: null as number | null,
    }));

  // Per-game aggregates from host_games for this single game.
  const aggMap = await gameAggregates([game.id]);
  const agg = aggMap.get(game.id);

  const detail = {
    ...shapeGame(game, shapedSessions.length, agg),
    liveSessions: shapedSessions,
  };

  // Bypass strict Zod parse to preserve liveHostsCount / minPricePerMinuteLzt.
  res.json(detail);
});

export default router;
