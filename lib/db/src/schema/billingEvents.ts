import {
  pgTable,
  uuid,
  timestamp,
  integer,
  text,
  index,
} from "drizzle-orm/pg-core";

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
  // Nullable: embed/dev-key-funded sessions (task-125) have no player behind
  // them — the dev key itself is billed instead. All player-flow inserts
  // still pass a real id, so this stays NOT NULL in practice for that path.
  playerId: uuid("player_id"),
  minutes: integer("minutes").notNull().default(1),
  // Which bucket this row reflects on the host side (and where the player
  // debit was taken from when non-zero).
  bucket: text("bucket").notNull().default("green"),
  playerDebitLzt: integer("player_debit_lzt").notNull().default(0),
  hostCreditLzt: integer("host_credit_lzt").notNull().default(0),
  // Event type. Default `session_tick` keeps existing rows / inserts unchanged.
  // Quota-aware values:
  //   quota_royalty        — royalty cut moved to the quota owner
  //   quota_sponsor_host   — sponsor escrow → host
  //   quota_sponsor_player — sponsor escrow → player
  //   quota_escrow_lock    — owner published a sponsor quota (escrow funded)
  //   quota_escrow_refund  — leftover escrow returned to the owner
  kind: text("kind").notNull().default("session_tick"),
  // Set on every quota-related row. NULL for plain session ticks/launch fees.
  quotaId: uuid("quota_id"),
  billedAt: timestamp("billed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => ({
  sessionIdx: index("billing_events_session_idx").on(t.sessionId),
  quotaIdx: index("billing_events_quota_idx").on(t.quotaId),
}));

export type BillingEvent = typeof billingEventsTable.$inferSelect;
