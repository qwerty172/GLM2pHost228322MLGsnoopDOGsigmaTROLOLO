import { pgTable, uuid, timestamp, integer, text } from "drizzle-orm/pg-core";

// Each settlement (per-minute tick OR launch fee) records one row per bucket
// affected on the host side. For session billing the host's cut is split 50/50
// blue/green, so a single minute produces two rows. The player's debit is
// attributed to whichever bucket they chose to pay from on that row.
//
// All deltas are in integer LZT (1 USDT = 200 LZT).
export const billingEventsTable = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  hostId: uuid("host_id").notNull(),
  playerId: uuid("player_id").notNull(),
  minutes: integer("minutes").notNull().default(1),
  // Which bucket this row reflects on the host side (and where the player
  // debit was taken from when non-zero).
  bucket: text("bucket").notNull().default("green"),
  playerDebitLzt: integer("player_debit_lzt").notNull().default(0),
  hostCreditLzt: integer("host_credit_lzt").notNull().default(0),
  billedAt: timestamp("billed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BillingEvent = typeof billingEventsTable.$inferSelect;
