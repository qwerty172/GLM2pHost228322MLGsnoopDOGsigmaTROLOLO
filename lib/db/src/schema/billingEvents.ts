import {
  pgTable,
  uuid,
  timestamp,
  numeric,
  integer,
} from "drizzle-orm/pg-core";

export const billingEventsTable = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull(),
  hostId: uuid("host_id").notNull(),
  playerId: uuid("player_id").notNull(),
  minutes: integer("minutes").notNull().default(1),
  playerDebit: numeric("player_debit", { precision: 18, scale: 6 }).notNull(),
  hostCredit: numeric("host_credit", { precision: 18, scale: 6 }).notNull(),
  commissionAmount: numeric("commission_amount", {
    precision: 18,
    scale: 6,
  }).notNull(),
  billedAt: timestamp("billed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BillingEvent = typeof billingEventsTable.$inferSelect;
