import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hostsTable } from "./hosts";
import { playersTable } from "./players";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => hostsTable.id, { onDelete: "cascade" }),
  playerToken: text("player_token").notNull().unique(),
  claimedByPlayerId: uuid("claimed_by_player_id").references(
    () => playersTable.id,
    { onDelete: "set null" },
  ),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastBilledAt: timestamp("last_billed_at", { withTimezone: true }),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  playerToken: true,
  status: true,
  createdAt: true,
  startedAt: true,
  endedAt: true,
  lastBilledAt: true,
  claimedByPlayerId: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
