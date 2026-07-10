import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// Developer API keys — a "key-wallet" hybrid used by the embeddable widget
// (see steps in task-125). A dev key behaves like a host/player for LZT
// balance purposes (same green/blue bucket split, same deposit-address flow)
// but has no login of its own: possession of the key IS the credential.
//
// hostRulesJson is a small declarative filter applied when the embed
// endpoint has to choose among several hosts capable of running the
// requested game:
//   maxPricePerMinuteLzt?: number   — only consider hosts at/under this rate
//   tags?: string[]                 — host.tags must include ALL of these
//                                      (used loosely for region/genre hints)
export interface DevKeyHostRules {
  maxPricePerMinuteLzt?: number;
  tags?: string[];
}

export const devKeysTable = pgTable("dev_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKey: text("api_key").notNull().unique(),
  displayName: text("display_name").notNull().default(""),
  // Two LZT buckets, mirroring hosts/players — deposits credit these via the
  // same economy.ts/depositWorker.ts path using ownerType = "dev_key".
  internalBalanceLzt: integer("internal_balance_lzt").notNull().default(0),
  withdrawableBalanceLzt: integer("withdrawable_balance_lzt")
    .notNull()
    .default(0),
  // Not used for lending, kept only so devKeysTable satisfies the same shape
  // economy.ts expects from a "user" table (creditDebtLzt column is read by
  // splitPayoutLzt callers). Always 0 for dev keys.
  creditDebtLzt: integer("credit_debt_lzt").notNull().default(0),
  creditReceivableLzt: integer("credit_receivable_lzt").notNull().default(0),
  lifetimeDepositUsdtCents: integer("lifetime_deposit_usdt_cents")
    .notNull()
    .default(0),
  // Unused by dev keys (no tariff/premium/withdrawal machinery — see
  // creditDevKeyDeposit and recordWithdrawalDebit's Exclude<..,"dev_key">).
  // Present only so devKeysTable satisfies the shared "user table" shape
  // that generic economy.ts helpers (userTable()) are typed against.
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
  maxDepositUsdtCents: integer("max_deposit_usdt_cents").notNull().default(0),
  maxWithdrawalUsdtCents: integer("max_withdrawal_usdt_cents")
    .notNull()
    .default(0),
  // "active" | "disabled" — disabled keys are rejected by /embed/sessions.
  status: text("status").notNull().default("active"),
  hostRulesJson: jsonb("host_rules_json").$type<DevKeyHostRules>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DevKey = typeof devKeysTable.$inferSelect;
