import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { hostsTable } from "./hosts";

export const depositAddressesTable = pgTable(
  "deposit_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => hostsTable.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    label: text("label").notNull(),
    address: text("address").notNull(),
    network: text("network").notNull(),
    minDeposit: numeric("min_deposit", { precision: 18, scale: 6 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    hostCurrencyUnique: uniqueIndex("deposit_addresses_host_currency_idx").on(
      t.hostId,
      t.currency,
    ),
  }),
);

export type DepositAddress = typeof depositAddressesTable.$inferSelect;
