import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { gamesTable } from "./games";

export const playerGameSavesTable = pgTable(
  "player_game_saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => playersTable.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => gamesTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentHash: text("content_hash").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    playerGameUnique: uniqueIndex("player_game_saves_player_game_idx").on(
      t.playerId,
      t.gameId,
    ),
  }),
);

export type PlayerGameSave = typeof playerGameSavesTable.$inferSelect;
