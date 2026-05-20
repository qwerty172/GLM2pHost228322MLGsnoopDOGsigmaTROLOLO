import { pool } from "@workspace/db";
import { logger } from "./logger";

// One-time idempotent backfill: populate host_games from the legacy
// host-level fields (game_id, bound_app_path, bound_url, minute_price_usd)
// and update sessions.game_id from the host's game binding where null.
//
// Both statements use ON CONFLICT / WHERE-NULL guards so re-running on
// every startup is safe and cheap.
export async function runLegacyBackfill(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Back-populate host_games from legacy hosts fields.
    //    Converts minutePriceUsd → integer LZT (200 LZT = 1 USDT).
    //    Clamps to 0 in case of negative legacy values.
    const { rowCount: hgRows } = await client.query(`
      INSERT INTO host_games (
        host_id, game_id, price_per_minute_lzt,
        app_path, bound_url,
        enabled, sort_order
      )
      SELECT
        h.id,
        h.game_id,
        GREATEST(0, ROUND(h.minute_price_usd::numeric * 200)::int),
        COALESCE(h.bound_app_path, ''),
        COALESCE(h.bound_url, ''),
        true,
        0
      FROM hosts h
      WHERE h.game_id IS NOT NULL
      ON CONFLICT (host_id, game_id) DO NOTHING
    `);

    // 2. Back-fill sessions.game_id from host's legacy game binding.
    const { rowCount: sRows1 } = await client.query(`
      UPDATE sessions s
      SET    game_id = h.game_id
      FROM   hosts h
      WHERE  s.host_id   = h.id
        AND  s.game_id   IS NULL
        AND  h.game_id   IS NOT NULL
    `);

    // 3. Still-NULL sessions: try to resolve via case-insensitive appName match.
    //    This catches sessions created before the game catalog existed or before
    //    the host had a game binding set.
    const { rowCount: sRows2 } = await client.query(`
      UPDATE sessions s
      SET    game_id = g.id
      FROM   games g
      WHERE  s.game_id IS NULL
        AND  lower(s.app_name) = lower(g.title)
    `);
    const sRows = (sRows1 ?? 0) + (sRows2 ?? 0);

    await client.query("COMMIT");

    if ((hgRows ?? 0) > 0 || (sRows ?? 0) > 0) {
      logger.info(
        { hostGameRows: hgRows, sessionRows: sRows },
        "Legacy backfill applied",
      );
    }
  } catch (err) {
    await client.query("ROLLBACK");
    // Non-fatal: log and continue — the server is still usable without the
    // backfill, it just means some legacy sessions won't have a gameId yet.
    logger.error({ err }, "Legacy backfill failed (non-fatal)");
  } finally {
    client.release();
  }
}
