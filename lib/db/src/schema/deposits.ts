import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const depositsTable = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    currency: text("currency").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    txHash: text("tx_hash").notNull(),
    grossAmount: numeric("gross_amount", { precision: 18, scale: 6 }).notNull(),
    commissionAmount: numeric("commission_amount", {
      precision: 18,
      scale: 6,
    }).notNull(),
    netAmount: numeric("net_amount", { precision: 18, scale: 6 }).notNull(),
    status: text("status").notNull().default("credited"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
  },
  (t) => ({
    txHashUnique: uniqueIndex("deposits_network_tx_hash_idx").on(
      t.network,
      t.txHash,
    ),
  }),
);

export type Deposit = typeof depositsTable.$inferSelect;
