import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerType: text("owner_type").notNull().default("host"),
  ownerId: uuid("owner_id").notNull(),
  currency: text("currency").notNull(),
  address: text("address").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
