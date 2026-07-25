import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// Append-only journal of every LZT movement on the platform. All entries are
// integer LZT (1 USDT = 200 LZT).
//
// `ownerType` is one of: "host", "player", "system".
// `bucket` is one of: "cash" (зелёный / withdrawableBalanceLzt),
//   "balance" (синий / internalBalanceLzt), "debt" (creditDebtLzt),
//   "escrow" (loan escrow), "reserve" (systemAccounts).
// `delta` is the signed integer LZT moved into the (owner,bucket) cell.
//
// The economy service writes one row per (owner,bucket) leg of a movement;
// debit and credit rows share a `groupId` so a single payment can be
// reconstructed.
export const ledgerTable = pgTable(
  "ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull(),
    kind: text("kind").notNull(),
    ownerType: text("owner_type").notNull(),
    ownerId: uuid("owner_id"),
    bucket: text("bucket").notNull(),
    deltaLzt: integer("delta_lzt").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ledger_owner_idx").on(t.ownerType, t.ownerId),
    // Wallet history: newest-first by owner.
    index("ledger_owner_created_idx").on(t.ownerType, t.ownerId, t.createdAt),
    index("ledger_group_idx").on(t.groupId),
    index("ledger_kind_idx").on(t.kind),
  ],
);

export type LedgerEntry = typeof ledgerTable.$inferSelect;
