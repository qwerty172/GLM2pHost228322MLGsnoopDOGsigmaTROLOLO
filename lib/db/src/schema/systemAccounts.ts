import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

// Single-row-per-key platform accounting. Known keys:
//   "interest_reserve" — funds weekly balance interest payouts
//   "platform_fees"    — total fees collected from deposits & loan disbursals
export const systemAccountsTable = pgTable("system_accounts", {
  key: text("key").primaryKey(),
  balanceLzt: integer("balance_lzt").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SystemAccount = typeof systemAccountsTable.$inferSelect;
