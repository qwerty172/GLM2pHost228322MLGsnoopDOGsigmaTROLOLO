import { db, gamesTable, type InsertGame } from "@workspace/db";
import { eq, notInArray } from "drizzle-orm";
import { logger } from "./logger";
import { pool } from "@workspace/db";

// Slugs that should exist as real catalog entries. Everything else that was
// seeded by the old SEED array (placeholder games with generic covers) will
// be deleted from the DB on startup so they never reappear.
const KEEP_SLUGS = [
  "rogue-fable-3",
];

// Slugs of the old placeholder/dummy games seeded by the legacy SEED list.
// We delete these rows from the DB on startup (if they still exist).
const DUMMY_SLUGS = [
  "cyberpunk-2077",
  "elden-ring",
  "helldivers-2",
  "minecraft",
  "skyrim-special-edition",
  "counter-strike-2",
  "dota-2",
  "satisfactory",
];

// Title patterns that indicate leftover test/CI records. We mark them
// is_hidden=true rather than deleting because they may have FK references.
const TEST_TITLE_FRAGMENTS = [
  "pipeline test",
  "approve notif test",
  "new unique game",
];

const SEED: InsertGame[] = [
  {
    slug: "rogue-fable-3",
    title: "Rogue Fable III",
    genre: "Browser Roguelike",
    coverImageUrl: "/rf3-cover.svg",
    description:
      "Пошаговый браузерный рогалик. Запускается прямо из твоей вкладки браузера — установка агента не нужна.",
    hasMods: true,
    isMultiplayer: false,
    hostSpectatesPlayer: true,
    hasQuests: true,
    browserHostUrl: "games/rf3/index.html",
  },
];

export async function seedGames(): Promise<void> {
  // 1. Upsert the canonical seed entries.
  for (const g of SEED) {
    const [existing] = await db
      .select()
      .from(gamesTable)
      .where(eq(gamesTable.slug, g.slug));
    if (existing) {
      await db
        .update(gamesTable)
        .set({
          title: g.title,
          genre: g.genre ?? "",
          coverImageUrl: g.coverImageUrl ?? "",
          description: g.description ?? "",
          hasMods: g.hasMods ?? false,
          isMultiplayer: g.isMultiplayer ?? false,
          hostSpectatesPlayer: g.hostSpectatesPlayer ?? false,
          hasQuests: g.hasQuests ?? false,
          browserHostUrl: g.browserHostUrl ?? "",
          // Make sure canonical games are always visible.
          isHidden: false,
        })
        .where(eq(gamesTable.id, existing.id));
    } else {
      await db.insert(gamesTable).values({
        ...g,
        recSpecs: (g.recSpecs ?? null) as typeof gamesTable.$inferInsert["recSpecs"],
      });
    }
  }
  logger.info({ count: SEED.length }, "Games catalog seeded");

  // 2. Delete the old placeholder dummy games (no sessions, just cover art stubs).
  //    We use raw SQL with a safe guard: skip rows that have any FK references
  //    from sessions or host_games so we don't break live data.
  const client = await pool.connect();
  try {
    // Delete dummies that have no session or host_game FK references.
    const { rowCount: deleted } = await client.query(`
      DELETE FROM games
      WHERE slug = ANY($1::text[])
        AND id NOT IN (SELECT DISTINCT game_id FROM sessions WHERE game_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT game_id FROM host_games)
    `, [DUMMY_SLUGS]);
    if (deleted && deleted > 0) {
      logger.info({ deleted }, "Removed placeholder dummy games from catalog");
    }

    // Any remaining dummy games (FK-blocked) get soft-hidden so they don't
    // pollute the public catalog.
    const { rowCount: hiddenDummies } = await client.query(`
      UPDATE games SET is_hidden = true
      WHERE slug = ANY($1::text[])
        AND is_hidden = false
    `, [DUMMY_SLUGS]);
    if (hiddenDummies && hiddenDummies > 0) {
      logger.info({ hiddenDummies }, "Hid FK-blocked dummy games from catalog");
    }

    // Test/CI records: try hard-delete first (safe when no FK refs),
    // fall back to soft-hide for FK-blocked rows.
    for (const fragment of TEST_TITLE_FRAGMENTS) {
      const { rowCount: deleted } = await client.query(`
        DELETE FROM games
        WHERE lower(title) LIKE $1
          AND id NOT IN (SELECT DISTINCT game_id FROM sessions WHERE game_id IS NOT NULL)
          AND id NOT IN (SELECT DISTINCT game_id FROM host_games)
      `, [`%${fragment}%`]);
      if (deleted && deleted > 0) {
        logger.info({ fragment, deleted }, "Deleted test game records");
      }

      // Any remaining test rows with FK refs get soft-hidden.
      const { rowCount: hidden } = await client.query(`
        UPDATE games SET is_hidden = true
        WHERE lower(title) LIKE $1
          AND is_hidden = false
      `, [`%${fragment}%`]);
      if (hidden && hidden > 0) {
        logger.info({ fragment, hidden }, "Hid FK-blocked test game records");
      }
    }
  } finally {
    client.release();
  }
}
