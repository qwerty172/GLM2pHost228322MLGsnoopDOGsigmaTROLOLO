import { pgTable, text, uuid, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gamesTable = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  coverImageUrl: text("cover_image_url").notNull().default(""),
  description: text("description").notNull().default(""),
  genre: text("genre").notNull().default(""),
  category: text("category").notNull().default(""),
  genres: jsonb("genres").$type<string[]>().notNull().default([]),
  steamAppId: text("steam_app_id"),
  hasMods: boolean("has_mods").notNull().default(false),
  isMultiplayer: boolean("is_multiplayer").notNull().default(false),
  hostSpectatesPlayer: boolean("host_spectates_player")
    .notNull()
    .default(false),
  hasQuests: boolean("has_quests").notNull().default(false),
  browserHostUrl: text("browser_host_url").notNull().default(""),
  // Admin-controlled visibility flag. Hidden games are excluded from the
  // public catalog but stay in the DB so host_games / session FKs remain valid.
  isHidden: boolean("is_hidden").notNull().default(false),
  recSpecs: jsonb("rec_specs").$type<{
    gpuVram?: number | null;
    cpuCores?: number | null;
    ramGb?: number | null;
    downloadMbps?: number | null;
    uploadMbps?: number | null;
  } | null>(),
  specsSource: text("specs_source"),
  specsFetchedAt: timestamp("specs_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertGameSchema = createInsertSchema(gamesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof gamesTable.$inferSelect;
