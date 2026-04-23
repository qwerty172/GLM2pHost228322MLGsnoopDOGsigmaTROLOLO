import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const depositAddressesTable = pgTable(
  "deposit_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    currency: text("currency").notNull(),
    label: text("label").notNull(),
    address: text("address").notNull(),
    network: text("network").notNull(),
    encryptedPrivateKey: text("encrypted_private_key"),
    minDeposit: numeric("min_deposit", { precision: 18, scale: 6 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerCurrencyUnique: uniqueIndex(
      "deposit_addresses_owner_currency_idx",
    ).on(t.ownerType, t.ownerId, t.currency),
    addressIdx: index("deposit_addresses_address_idx").on(t.address),
  }),
);

export type DepositAddress = typeof depositAddressesTable.$inferSelect;
