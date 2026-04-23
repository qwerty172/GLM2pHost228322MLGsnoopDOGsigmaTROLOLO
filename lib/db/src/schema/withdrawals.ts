import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

export const withdrawalsTable = pgTable("withdrawals", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => hostsTable.id, { onDelete: "cascade" }),
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
