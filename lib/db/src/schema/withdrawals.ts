import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: text("owner_type").notNull().default("host"),
  ownerId: uuid("owner_id").notNull(),
  currency: text("currency").notNull(),
  address: text("address").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  status: text("status").notNull().default("pending"),
  txHash: text("tx_hash"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processingAt: timestamp("processing_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  ownerIdx: index("withdrawals_owner_idx").on(t.ownerType, t.ownerId),
  statusIdx: index("withdrawals_status_idx").on(t.status),
}));

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
