import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hostsTable } from "./hosts";
import { playersTable } from "./players";
import { gamesTable } from "./games";
import { devKeysTable } from "./devKeys";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => hostsTable.id, { onDelete: "cascade" }),
  // Which game from the host's library this session is for.
  // NOT NULL enforced at the application level and DB level.
  // onDelete: "restrict" prevents accidental game deletion while sessions exist —
  // correct for billing-audit integrity (active sessions reference a paid game).
  // Legacy NULL rows were back-filled via the legacyBackfill startup migration.
  gameId: uuid("game_id")
    .notNull()
    .references(() => gamesTable.id, { onDelete: "restrict" }),
  playerToken: text("player_token").notNull().unique(),
  claimedByPlayerId: uuid("claimed_by_player_id").references(
    () => playersTable.id,
    { onDelete: "set null" },
  ),
  // Set when this session was created through the embeddable widget
  // (POST /embed/sessions). When present, the billing worker debits this
  // dev key's balance instead of requiring claimedByPlayerId — there is no
  // logged-in player behind an embed session.
  devKeyId: uuid("dev_key_id").references(() => devKeysTable.id, {
    onDelete: "set null",
  }),
  appName: text("app_name").notNull(),
  status: text("status").notNull().default("pending"),
  resolution: text("resolution").notNull().default("1920x1080"),
  bitrateKbps: integer("bitrate_kbps").notNull().default(6000),
  ratePerMinute: text("rate_per_minute").notNull().default("0.04"),
  // Which LZT bucket the player wants to be billed from:
  //   "green" → only зелёный (withdrawable)
  //   "blue"  → only синий (internal)
  //   "auto"  → prefer green, fall back to blue
  paymentSource: text("payment_source").notNull().default("auto"),
  // Optional quota preset-contract attached to this session. The billing
  // worker reads it on every tick to apply royalty/sponsor adjustments.
  quotaId: uuid("quota_id"),
  // Block-time billing: player pre-purchases a fixed block of minutes (10/15/25).
  // blockMinutes: the block size chosen at session start (null = unlimited/per-minute).
  // blockReservedLzt: total LZT reserved for the block (blockMinutes × ratePerMinuteLzt).
  // The billing worker drains from this reserve each tick; unused reserve is refunded on exit.
  blockMinutes: integer("block_minutes"),
  blockReservedLzt: integer("block_reserved_lzt"),
  // Self-test session launched by the host to verify their own setup.
  // No launch fee, no per-minute billing (the billing worker skips these),
  // no host earnings — purely a technical stream check.
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }),
  endReason: text("end_reason"),
}, (t) => ({
  hostStatusIdx: index("sessions_host_status_idx").on(t.hostId, t.status),
  statusIdx: index("sessions_status_idx").on(t.status),
  quotaIdx: index("sessions_quota_idx").on(t.quotaId),
}));

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  playerToken: true,
  status: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
  lastBilledAt: true,
  claimedByPlayerId: true,
  devKeyId: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
