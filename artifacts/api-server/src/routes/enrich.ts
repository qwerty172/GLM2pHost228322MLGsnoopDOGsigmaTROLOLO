import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, gamesTable } from "@workspace/db";
import { parseSteamPcRequirements, recSpecsToJson } from "../lib/steamSpecs";
import { rateLimit, ipKey } from "../lib/rateLimit";

const router = Router();

const enrichLimiter = rateLimit({
  scope: "enrich",
  windowMs: 60_000,
  max: 40,
  keyFn: ipKey,
});

// Simple in-memory cache (key → {data, expiresAt})
const cache = new Map<string, { data: unknown; expiresAt: number }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data as T);
  return fn().then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

// ---------------------------------------------------------------------------
// GET /api/games/rawg-search?q=<query>
// Game search with cover + metadata. Uses RAWG if RAWG_API_KEY is set,
// otherwise falls back to Steam Store Search (no key required).
// ---------------------------------------------------------------------------
router.get("/games/rawg-search", enrichLimiter, async (req, res): Promise<void> => {
  const q = z.string().min(2).max(100).safeParse(req.query.q);
  if (!q.success) {
    res.status(400).json({ error: "q must be 2–100 chars" });
    return;
  }
  const query = q.data.trim();
  const rawgKey = process.env.RAWG_API_KEY;

  try {
    const results = await cached(`rawg:${query}`, 5 * 60_000, async () => {
      // --- RAWG path (when API key is configured) ---
      if (rawgKey) {
        const url = `https://api.rawg.io/api/games?key=${rawgKey}&search=${encodeURIComponent(query)}&page_size=6&ordering=-added`;
        const r = await fetch(url, {
          headers: { "User-Agent": "DecentralHub/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) throw new Error(`RAWG ${r.status}`);
        const json = (await r.json()) as {
          results?: Array<{
            id: number;
            name: string;
            background_image: string | null;
            genres: Array<{ name: string }>;
            rating: number;
            metacritic: number | null;
          }>;
        };
        return (json.results ?? []).map((g) => ({
          rawgId: String(g.id),
          title: g.name,
          coverImageUrl: g.background_image ?? null,
          genres: (g.genres ?? []).map((x) => x.name),
          rating: g.rating ?? null,
          metacritic: g.metacritic ?? null,
          source: "rawg" as const,
        }));
      }

      // --- Steam Store Search fallback (no key required) ---
      const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&cc=ru&l=russian&count=6`;
      const r = await fetch(url, {
        headers: { "User-Agent": "DecentralHub/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`Steam search ${r.status}`);
      const json = (await r.json()) as {
        items?: Array<{
          id: number;
          name: string;
          tiny_image: string;
          metascore: string;
          platforms: { windows?: boolean };
        }>;
      };
      const items = (json.items ?? []).filter((i) => i.platforms?.windows !== false);
      return items.map((g) => ({
        rawgId: String(g.id),
        title: g.name,
        // Steam storesearch only has tiny_image; use full header image by appId
        coverImageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${g.id}/header.jpg`,
        genres: [] as string[],
        rating: null,
        metacritic: g.metascore ? Number(g.metascore) : null,
        steamAppId: String(g.id),
        source: "steam" as const,
      }));
    });

    res.json(results);
  } catch (err) {
    res.status(502).json({ error: "Game search failed", detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /api/games/steam-lookup?appId=<steamAppId>
// Fetches game metadata from Steam Store API + current player count.
// No API key required.
// ---------------------------------------------------------------------------
router.get("/games/steam-lookup", enrichLimiter, async (req, res): Promise<void> => {
  const appId = z.string().regex(/^\d{1,10}$/).safeParse(req.query.appId);
  if (!appId.success) {
    res.status(400).json({ error: "appId must be numeric" });
    return;
  }
  const id = appId.data;

  try {
    const result = await cached(`steam:${id}`, 10 * 60_000, async () => {
      // Fetch app details + player count in parallel
      const [detailsRes, playersRes] = await Promise.all([
        fetch(
          `https://store.steampowered.com/api/appdetails?appids=${id}&cc=ru&l=russian`,
          { headers: { "User-Agent": "DecentralHub/1.0" }, signal: AbortSignal.timeout(6000) },
        ),
        fetch(
          `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${id}`,
          { headers: { "User-Agent": "DecentralHub/1.0" }, signal: AbortSignal.timeout(4000) },
        ).catch(() => null),
      ]);

      if (!detailsRes.ok) throw new Error(`Steam ${detailsRes.status}`);
      const detailsJson = (await detailsRes.json()) as Record<
        string,
        { success: boolean; data?: {
          name: string;
          short_description: string;
          header_image: string;
          genres?: Array<{ description: string }>;
          categories?: Array<{ description: string }>;
          is_free: boolean;
          metacritic?: { score: number };
          pc_requirements?: { minimum?: string; recommended?: string };
        }}
      >;

      const entry = detailsJson[id];
      if (!entry?.success || !entry.data) throw new Error("Steam app not found");
      const d = entry.data;

      let currentPlayers: number | null = null;
      if (playersRes?.ok) {
        const pj = (await playersRes.json()) as { response?: { player_count?: number } };
        currentPlayers = pj?.response?.player_count ?? null;
      }

      const parsedSpecs = parseSteamPcRequirements(d);
      const recSpecs = recSpecsToJson(parsedSpecs.rec);

      // Cache specs on catalog game if it exists.
      const [catalogGame] = await db
        .select({ id: gamesTable.id })
        .from(gamesTable)
        .where(eq(gamesTable.steamAppId, id));
      if (catalogGame) {
        await db
          .update(gamesTable)
          .set({
            recSpecs,
            specsSource: "steam",
            specsFetchedAt: new Date(),
          })
          .where(eq(gamesTable.id, catalogGame.id));
      }

      return {
        steamAppId: id,
        title: d.name,
        coverImageUrl: d.header_image,
        description: d.short_description,
        genres: (d.genres ?? []).map((g) => g.description),
        metacritic: d.metacritic?.score ?? null,
        currentPlayers,
        recSpecs,
        minSpecs: recSpecsToJson(parsedSpecs.min),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Steam lookup failed", detail: String(err) });
  }
});

export default router;
