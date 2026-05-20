import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const playersTable = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerToken: text("player_token").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Two LZT buckets (integer LZT, 1 USDT = 200 LZT).
  //   internal   → "синий" balance/card. Spent inside the platform; earns
  //                weekly interest. Maps to the task's `balanceLzt`.
  //   withdrawable → "зелёный" cash banknote. Convertible to crypto at
  //                  200:1 and withdrawable. Maps to `cashLzt`.
  internalBalanceLzt: integer("internal_balance_lzt").notNull().default(0),
  withdrawableBalanceLzt: integer("withdrawable_balance_lzt")
    .notNull()
    .default(0),
  // Aggregate of unpaid principal across all loans where the user is the
  // borrower (loan_type=p2p|host_service). Triggers the 40/40/20 split on
  // incoming payments while > 0.
  creditDebtLzt: integer("credit_debt_lzt").notNull().default(0),
  // Aggregate of outstanding principal owed *to* the user as a lender.
  creditReceivableLzt: integer("credit_receivable_lzt")
    .notNull()
    .default(0),
  // Sub-LZT remainder from weekly interest, carried until it adds up to ≥1.
  pendingInterestFractionLzt: integer("pending_interest_fraction_lzt")
    .notNull()
    .default(0),
  // Snapshot of internalBalanceLzt taken at the end of the previous interest
  // tick. Used to approximate the weekly average balance as
  //   avg ≈ (interestSampleLzt + internalBalanceLzt) / 2
  // which is the simplest defensible "average over the week" without
  // instrumenting every balance-mutating call site.
  interestSampleLzt: integer("interest_sample_lzt").notNull().default(0),
  // Lifetime deposit volume in USDT cents (1¢ = 0.01 USDT) — drives tariff tier.
  lifetimeDepositUsdtCents: integer("lifetime_deposit_usdt_cents")
    .notNull()
    .default(0),
  // Largest single deposit / withdrawal in USDT cents — bounds the Pledger
  // limit for P2P loan requests.
  maxDepositUsdtCents: integer("max_deposit_usdt_cents").notNull().default(0),
  maxWithdrawalUsdtCents: integer("max_withdrawal_usdt_cents")
    .notNull()
    .default(0),
  premiumUntil: timestamp("premium_until", { withTimezone: true }),
  kycVerified: boolean("kyc_verified").notNull().default(false),
  hasDefault: boolean("has_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
