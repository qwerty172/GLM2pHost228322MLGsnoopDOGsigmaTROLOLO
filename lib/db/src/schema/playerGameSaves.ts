import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";
import { playersTable } from "./players";

/** Per-player cloud save metadata for a game. */
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
    storageKey: text("storage_key").notNull(),
    version: integer("version").notNull().default(1),
    sizeBytes: integer("size_bytes").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("player_game_saves_player_game_idx").on(t.playerId, t.gameId)],
);

export const insertPlayerGameSaveSchema = createInsertSchema(
  playerGameSavesTable,
).omit({ id: true, updatedAt: true });
export type InsertPlayerGameSave = z.infer<typeof insertPlayerGameSaveSchema>;
export type PlayerGameSave = typeof playerGameSavesTable.$inferSelect;

export type SaveManifestEntry = {
  label: string;
  pathTemplate: string;
  provider: "steam" | "custom";
};
