import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";
import { gamesTable } from "./games";

// Junction table: one host may offer multiple games from their library.
// Each row describes the host-specific settings for one game entry:
// local path / URL (how the host agent launches it), the per-minute price
// in integer LZT, and operational flags (enabled, locally available).
//
// Pricing: 1 USDT = 200 LZT (platform fixed rate). Default 8 LZT/min ≈ $0.04/min.
//
// The old hosts.gameId / boundAppPath / boundUrl / boundAppLabel fields are
// preserved for backward compatibility with running host agents (< v2). New
// code should use this table instead of those deprecated columns.
export const hostGamesTable = pgTable(
  "host_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => hostsTable.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),

    // Price the host charges per streaming minute, in integer LZT.
    // 200 LZT = 1 USDT. Must be >= 0 (no negative library entries).
    pricePerMinuteLzt: integer("price_per_minute_lzt").notNull().default(8),

    // For native-exe games: absolute Windows path to the .exe.
    // For browser games: empty string (use boundUrl instead).
    appPath: text("app_path").notNull().default(""),
    // For browser-game entries: https URL. Empty for native.
    boundUrl: text("bound_url").notNull().default(""),
    // Optional extra CLI arguments appended to the exe invocation.
    launchArgs: text("launch_args").notNull().default(""),

    // Host can temporarily disable a game without removing it.
    enabled: boolean("enabled").notNull().default(true),
    // Display order in the host's library UI (lower = first).
    sortOrder: integer("sort_order").notNull().default(0),

    // Set by the host agent after it validates the local appPath.
    // false = file not found / agent reported error.
    localAvailable: boolean("local_available").notNull().default(true),
    // Last error string reported by the agent (empty = no error).
    lastError: text("last_error").notNull().default(""),

    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("host_games_host_game_unique").on(t.hostId, t.gameId),
    index("host_games_host_idx").on(t.hostId, t.enabled),
    index("host_games_game_idx").on(t.gameId, t.enabled),
  ],
);

export type HostGame = typeof hostGamesTable.$inferSelect;
export type InsertHostGame = typeof hostGamesTable.$inferInsert;
