import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Games catalog: titles the platform officially supports (cover art,
// description, capability flags). Hosts stream a specific game from this
// catalog; players browse and filter the catalog to find live sessions.
//
// Capability flags double as filter chips on the player-facing browse page.
// `hasQuests` is reserved for a future quest/bounty mechanic where any user
// can post paid tasks against a game (not just the hoster). For now it's
// surfaced purely as a filter.
export const gamesTable = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  coverImageUrl: text("cover_image_url").notNull().default(""),
  description: text("description").notNull().default(""),
  // Free-form genre/tag (e.g. "Shooter", "RPG") used only for display.
  genre: text("genre").notNull().default(""),
  // Capability flags / filter chips.
  hasMods: boolean("has_mods").notNull().default(false),
  isMultiplayer: boolean("is_multiplayer").notNull().default(false),
  hostSpectatesPlayer: boolean("host_spectates_player")
    .notNull()
    .default(false),
  hasQuests: boolean("has_quests").notNull().default(false),
  // When set, this game can be hosted directly from the player's browser
  // (no desktop host agent). The URL must be same-origin so the host page
  // can inject input events into the iframe.
  browserHostUrl: text("browser_host_url").notNull().default(""),
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
