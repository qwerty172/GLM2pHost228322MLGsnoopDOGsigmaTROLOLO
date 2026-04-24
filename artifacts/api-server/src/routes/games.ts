import { Router, type IRouter } from "express";
import { and, eq, ilike, ne, sql, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, gamesTable, hostsTable, sessionsTable } from "@workspace/db";
import {
  GetGameBySlugParams,
  GetGameBySlugResponse,
  ListGamesResponse,
} from "@workspace/api-zod";
import { isHostAvailableNow } from "../lib/schedule";

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
  liveOnly: strictBool,
  search: z.string().optional(),
});

const router: IRouter = Router();

type GameRow = typeof gamesTable.$inferSelect;

function shapeGame(g: GameRow, liveSessionCount: number) {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    coverImageUrl: g.coverImageUrl,
    description: g.description,
    genre: g.genre,
    hasMods: g.hasMods,
    isMultiplayer: g.isMultiplayer,
    hostSpectatesPlayer: g.hostSpectatesPlayer,
    hasQuests: g.hasQuests,
    liveSessionCount,
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

router.get("/games", async (req, res): Promise<void> => {
  const parsed = ListGamesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const q = parsed.data;

  const conds = [];
  if (q.hasMods === true) conds.push(eq(gamesTable.hasMods, true));
  if (q.isMultiplayer === true)
    conds.push(eq(gamesTable.isMultiplayer, true));
  if (q.hostSpectatesPlayer === true)
    conds.push(eq(gamesTable.hostSpectatesPlayer, true));
  if (q.hasQuests === true) conds.push(eq(gamesTable.hasQuests, true));
  if (q.search && q.search.trim().length > 0) {
    conds.push(ilike(gamesTable.title, `%${q.search.trim()}%`));
  }

  const games = await db
    .select()
    .from(gamesTable)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(gamesTable.title);

  const counts = await liveCountsByTitle();
  let shaped = games.map((g) =>
    shapeGame(g, counts.get(g.title.toLowerCase()) ?? 0),
  );
  if (q.liveOnly === true) {
    shaped = shaped.filter((g) => g.liveSessionCount > 0);
  }

  res.json(ListGamesResponse.parse(shaped));
});

router.get("/games/:slug", async (req, res): Promise<void> => {
  const params = GetGameBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [game] = await db
    .select()
    .from(gamesTable)
    .where(eq(gamesTable.slug, params.data.slug));
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }

  // A "live" host listing for this game = either:
  //  (a) an open session whose appName matches the game title, OR
  //  (b) a host explicitly bound to this game via gameId (no session yet —
  //      players can request one via the existing session-create flow).
  // We then apply schedule-mode filtering so only currently-available hosts
  // appear in the catalog.
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
          ilike(sessionsTable.appName, game.title),
          eq(hostsTable.gameId, game.id),
        ),
      ),
    )
    .orderBy(sessionsTable.createdAt);

  const now = new Date();
  const shapedSessions = sessionRows
    .filter(({ host }) =>
      isHostAvailableNow(host.scheduleMode, host.scheduleJson ?? [], now),
    )
    .map(({ session: s, host: h }) => ({
      playerToken: s.playerToken,
      appName: s.appName,
      ratePerMinute: Number(s.ratePerMinute),
      resolution: s.resolution,
      bitrateKbps: s.bitrateKbps,
      status: s.status,
      createdAt: s.createdAt,
      hostDisplayName: h.displayName,
      boundAppLabel: h.boundAppLabel || s.appName,
      description: h.description,
      launchPriceUsd: Number(h.launchPriceUsd),
      minutePriceUsd: Number(h.minutePriceUsd),
      scheduleMode: h.scheduleMode,
      scheduleJson: h.scheduleJson ?? [],
      streamPlatform: h.streamPlatform,
    }));

  const detail = {
    ...shapeGame(game, shapedSessions.length),
    liveSessions: shapedSessions,
  };

  res.json(GetGameBySlugResponse.parse(detail));
});

export default router;
