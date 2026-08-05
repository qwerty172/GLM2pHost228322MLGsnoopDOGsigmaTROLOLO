import { db, gamesTable, type InsertGame } from "@workspace/db";
import { eq, notInArray } from "drizzle-orm";
import { logger } from "./logger";
import { pool } from "@workspace/db";

const KEEP_SLUGS: string[] = [];

const DUMMY_SLUGS = [
  "cyberpunk-2077",
  "elden-ring",
  "helldivers-2",
  "minecraft",
  "skyrim-special-edition",
  "counter-strike-2",
  "dota-2",
  "satisfactory",
  "rogue-fable-3",
];

const TEST_TITLE_FRAGMENTS = [
  "pipeline test",
  "approve notif test",
  "new unique game",
];

const SEED: InsertGame[] = [];

export async function seedGames(): Promise<void> {
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

  const client = await pool.connect();
  try {
    const { rowCount: deleted } = await client.query(`
      DELETE FROM games
      WHERE slug = ANY($1::text[])
        AND id NOT IN (SELECT DISTINCT game_id FROM sessions WHERE game_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT game_id FROM host_games)
    `, [DUMMY_SLUGS]);
    if (deleted && deleted > 0) {
      logger.info({ deleted }, "Removed placeholder dummy games from catalog");
    }

    const { rowCount: hiddenDummies } = await client.query(`
      UPDATE games SET is_hidden = true
      WHERE slug = ANY($1::text[])
        AND is_hidden = false
    `, [DUMMY_SLUGS]);
    if (hiddenDummies && hiddenDummies > 0) {
      logger.info({ hiddenDummies }, "Hid FK-blocked dummy games from catalog");
    }

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
