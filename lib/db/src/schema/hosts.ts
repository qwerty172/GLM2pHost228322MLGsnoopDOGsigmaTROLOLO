import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gamesTable } from "./games";

// A single weekly schedule slot: from `startMin` to `endMin` minutes-from-midnight,
// on the given `day` (0 = Sunday … 6 = Saturday). All times are UTC.
// Slots are interpreted in OR fashion: the host is "available" if NOW falls
// in any slot. When scheduleMode = "always", the schedule array is ignored.
export const scheduleSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export const scheduleSchema = z.array(scheduleSlotSchema).max(50);

export const hostsTable = pgTable("hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostToken: text("host_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Two LZT buckets (integer LZT, 1 USDT = 200 LZT). See players schema for
  // a fuller description of the blue (internal) / green (withdrawable) split.
  internalBalanceLzt: integer("internal_balance_lzt").notNull().default(0),
  withdrawableBalanceLzt: integer("withdrawable_balance_lzt")
    .notNull()
    .default(0),

  // -----------------------------------------------------------------
  // Host "offer" config — what this host streams and on what terms.
  // Set in the Host Dashboard, surfaced in the Games Library, and used
  // by the agent to decide which .exe to launch when a player joins.
  // -----------------------------------------------------------------

  // DEPRECATED — use hostGamesTable instead (multi-game library per host).
  // Kept for backward compat with host agents < v2 that still read these
  // fields directly. New code must read from host_games table.
  gameId: uuid("game_id").references(() => gamesTable.id, {
    onDelete: "set null",
  }),
  // DEPRECATED — use host_games.app_path
  boundAppPath: text("bound_app_path").notNull().default(""),
  // DEPRECATED — use host_games.bound_url
  boundUrl: text("bound_url").notNull().default(""),
  // DEPRECATED — use games.title joined via host_games
  boundAppLabel: text("bound_app_label").notNull().default(""),
  // Free-form host description (rules, hardware, vibe).
  description: text("description").notNull().default(""),
  // Capability tags shown in the library and used as filter facets,
  // e.g. ["Leveled-up account", "Adobe Premiere license"].
  tags: jsonb("tags").$type<string[]>().notNull().default([]),

  // Pricing (USD). Both rates may be negative, which inverts the cash flow
  // (the host pays the player — used for promos / "loss leaders").
  launchPriceUsd: numeric("launch_price_usd", { precision: 18, scale: 6 })
    .notNull()
    .default("0"),
  minutePriceUsd: numeric("minute_price_usd", { precision: 18, scale: 6 })
    .notNull()
    .default("0.04"),

  // Availability schedule.
  //   "always"    → host is open whenever the agent is connected
  //   "scheduled" → only inside the slots in `scheduleJson`
  scheduleMode: text("schedule_mode").notNull().default("always"),
  scheduleJson: jsonb("schedule_json")
    .$type<ScheduleSlot[]>()
    .notNull()
    .default([]),

  // Optional restream config — when the agent runs it can also forward the
  // capture to an RTMP endpoint (Twitch / YouTube / custom).
  streamPlatform: text("stream_platform").notNull().default(""),
  streamUrl: text("stream_url").notNull().default(""),
  streamKey: text("stream_key").notNull().default(""),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertHostSchema = createInsertSchema(hostsTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertHost = z.infer<typeof insertHostSchema>;
export type Host = typeof hostsTable.$inferSelect;
