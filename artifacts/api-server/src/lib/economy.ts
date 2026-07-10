// Central money mover for the v1 economy. All routes/workers that move LZT
// between users (or between a user and the platform) MUST go through this
// module — it's the single place that:
//   • writes the append-only `ledger` rows for each leg of a transfer,
//   • applies the 50/50 cash/balance split on incoming user payouts,
//   • applies the 40/40/20 debt-repay split when the recipient owes money,
//   • routes platform fees into the `system_accounts` ledger,
//   • keeps `creditDebtLzt` / `creditReceivableLzt` aggregates in sync.
//
// Bucket names used in the ledger:
//   "cash"    → withdrawableBalanceLzt  (зелёный)
//   "balance" → internalBalanceLzt      (синий)
//   "debt"    → creditDebtLzt           (sign convention: +delta means debt
//               grew, −delta means debt shrank)
//   "reserve" → system_accounts row     (ownerId is null, refId carries the key)
//   "escrow"  → loans.escrowLzt         (refId = loan id, ownerId is the lender)

import { eq, sql, and, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  hostsTable,
  playersTable,
  devKeysTable,
  ledgerTable,
  loansTable,
  systemAccountsTable,
} from "@workspace/db";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "@workspace/db/schema";

// "dev_key" is the widget-embed API key wallet — it shares the same
// green/blue bucket columns as hosts/players (see lib/db/src/schema/devKeys.ts)
// so it can flow through this module unmodified.
export type OwnerType = "host" | "player" | "dev_key";
export type UserBucket = "cash" | "balance";
export type LedgerBucket = UserBucket | "debt" | "reserve" | "escrow";

export type DbTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export const SYSTEM_INTEREST_RESERVE = "interest_reserve";
export const SYSTEM_PLATFORM_FEES = "platform_fees";

// ---------------------------------------------------------------- helpers

function userTable(t: OwnerType) {
  if (t === "host") return hostsTable;
  if (t === "dev_key") return devKeysTable;
  return playersTable;
}

async function getUserBalances(
  tx: DbTx,
  t: OwnerType,
  id: string,
): Promise<{ cash: number; balance: number; debt: number } | null> {
  const tbl = userTable(t);
  const [row] = await tx
    .select({
      cash: tbl.withdrawableBalanceLzt,
      balance: tbl.internalBalanceLzt,
      debt: tbl.creditDebtLzt,
    })
    .from(tbl)
    .where(eq(tbl.id, id));
  return row ?? null;
}

async function writeLedger(
  tx: DbTx,
  rows: Array<{
    groupId: string;
    kind: string;
    ownerType: OwnerType | "system";
    ownerId: string | null;
    bucket: LedgerBucket;
    deltaLzt: number;
    refType?: string | null;
    refId?: string | null;
    note?: string | null;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(ledgerTable).values(
    rows.map((r) => ({
      groupId: r.groupId,
      kind: r.kind,
      ownerType: r.ownerType,
      ownerId: r.ownerId ?? null,
      bucket: r.bucket,
      deltaLzt: r.deltaLzt,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      note: r.note ?? null,
    })),
  );
}

// Apply a bucket delta to the user row. Positive → credit, negative → debit
// (debit fails if the bucket would go below 0 — caller must pre-check or
// rely on the returned boolean).
async function adjustUserBucket(
  tx: DbTx,
  t: OwnerType,
  id: string,
  bucket: UserBucket | "debt",
  delta: number,
): Promise<boolean> {
  if (delta === 0) return true;
  const tbl = userTable(t);
  const col =
    bucket === "cash"
      ? tbl.withdrawableBalanceLzt
      : bucket === "balance"
        ? tbl.internalBalanceLzt
        : tbl.creditDebtLzt;
  if (delta > 0) {
    await tx
      .update(tbl)
      .set({
        [bucket === "cash"
          ? "withdrawableBalanceLzt"
          : bucket === "balance"
            ? "internalBalanceLzt"
            : "creditDebtLzt"]: sql`${col} + ${delta}`,
      } as never)
      .where(eq(tbl.id, id));
    return true;
  }
  const need = -delta;
  const updated = await tx
    .update(tbl)
    .set({
      [bucket === "cash"
        ? "withdrawableBalanceLzt"
        : bucket === "balance"
          ? "internalBalanceLzt"
          : "creditDebtLzt"]: sql`${col} - ${need}`,
    } as never)
    .where(and(eq(tbl.id, id), sql`${col} >= ${need}`))
    .returning({ id: tbl.id });
  return updated.length > 0;
}

async function adjustSystem(
  tx: DbTx,
  key: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  // upsert-then-update pattern
  await tx
    .insert(systemAccountsTable)
    .values({ key, balanceLzt: delta })
    .onConflictDoUpdate({
      target: systemAccountsTable.key,
      set: {
        balanceLzt: sql`${systemAccountsTable.balanceLzt} + ${delta}`,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------- splits

// Compute the per-bucket split of an incoming payout, respecting any active
// debt the recipient carries. We always round so the sum equals the input
// (no value created or destroyed).
export function splitPayoutLzt(
  amountLzt: number,
  recipientDebtLzt: number,
): { cash: number; balance: number; debt: number } {
  if (amountLzt <= 0) return { cash: 0, balance: 0, debt: 0 };
  const hasDebt = recipientDebtLzt > 0;
  if (!hasDebt) {
    // 50/50 with the rounding favouring cash (ceil), so a 1-LZT tick still
    // moves a real LZT into the green bucket.
    const cash = Math.ceil(amountLzt / 2);
    const balance = amountLzt - cash;
    return { cash, balance, debt: 0 };
  }
  // 40/40/20: debt repayment, balance, cash.
  let debtPay = Math.floor((amountLzt * 40) / 100);
  if (debtPay > recipientDebtLzt) debtPay = recipientDebtLzt;
  const rest = amountLzt - debtPay;
  // Of the rest, split 40/20 → which is 2/3 balance, 1/3 cash.
  const balance = Math.floor((rest * 2) / 3);
  const cash = rest - balance;
  return { cash, balance, debt: debtPay };
}

// ---------------------------------------------------------------- public API

// Credit a user with an incoming LZT payout (host minute earnings, freelance
// payment, manual transfer). Applies the 50/50 or 40/40/20 split and writes
// ledger rows. Loan-repay side-effects from the debt slice are handled here.
export async function creditPayoutToUser(
  tx: DbTx,
  args: {
    ownerType: OwnerType;
    ownerId: string;
    amountLzt: number;
    kind: string;
    refType?: string | null;
    refId?: string | null;
    groupId?: string;
    note?: string | null;
  },
): Promise<{ cash: number; balance: number; debt: number }> {
  const amt = Math.floor(args.amountLzt);
  if (amt <= 0) return { cash: 0, balance: 0, debt: 0 };
  const balances = await getUserBalances(tx, args.ownerType, args.ownerId);
  const split = splitPayoutLzt(amt, balances?.debt ?? 0);
  const groupId = args.groupId ?? randomUUID();

  if (split.cash > 0)
    await adjustUserBucket(tx, args.ownerType, args.ownerId, "cash", split.cash);
  if (split.balance > 0)
    await adjustUserBucket(
      tx,
      args.ownerType,
      args.ownerId,
      "balance",
      split.balance,
    );
  if (split.debt > 0) {
    await repayBorrowerDebt(tx, {
      borrowerType: args.ownerType,
      borrowerId: args.ownerId,
      amountLzt: split.debt,
      groupId,
      refType: args.refType,
      refId: args.refId,
    });
  }

  const rows: Parameters<typeof writeLedger>[1] = [];
  if (split.cash > 0)
    rows.push({
      groupId,
      kind: args.kind,
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      bucket: "cash",
      deltaLzt: split.cash,
      refType: args.refType,
      refId: args.refId,
      note: args.note ?? null,
    });
  if (split.balance > 0)
    rows.push({
      groupId,
      kind: args.kind,
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      bucket: "balance",
      deltaLzt: split.balance,
      refType: args.refType,
      refId: args.refId,
      note: args.note ?? null,
    });
  await writeLedger(tx, rows);

  return split;
}

// Debit a user's chosen bucket(s) and route the cleared amount through
// `creditPayoutToUser` to the recipient. Used for internal payments (a
// freelance order paid out of `balance`, a manual transfer, etc.).
//
// Returns `{ ok: false }` if the payer's bucket is short.
export async function payInternal(
  tx: DbTx,
  args: {
    fromType: OwnerType;
    fromId: string;
    toType: OwnerType;
    toId: string;
    amountLzt: number;
    source: UserBucket; // which bucket the payer pays from
    kind?: string;
    refType?: string | null;
    refId?: string | null;
  },
): Promise<
  | { ok: true; split: { cash: number; balance: number; debt: number } }
  | { ok: false; reason: string }
> {
  const amt = Math.floor(args.amountLzt);
  if (amt <= 0) return { ok: false, reason: "amount must be positive" };
  const debited = await adjustUserBucket(
    tx,
    args.fromType,
    args.fromId,
    args.source,
    -amt,
  );
  if (!debited)
    return { ok: false, reason: `insufficient ${args.source} balance` };

  const groupId = randomUUID();
  await writeLedger(tx, [
    {
      groupId,
      kind: args.kind ?? "internal_pay",
      ownerType: args.fromType,
      ownerId: args.fromId,
      bucket: args.source,
      deltaLzt: -amt,
      refType: args.refType,
      refId: args.refId,
    },
  ]);

  const split = await creditPayoutToUser(tx, {
    ownerType: args.toType,
    ownerId: args.toId,
    amountLzt: amt,
    kind: args.kind ?? "internal_pay",
    refType: args.refType,
    refId: args.refId,
    groupId,
  });
  return { ok: true, split };
}

// ---------------------------------------------------------------- loans

// Apply `amountLzt` against the borrower's open loans, oldest first. Updates
// each loan's outstanding/repaid totals, the borrower's `creditDebtLzt`
// aggregate, and the lender side (cash payout on close, or per-tranche balance
// streaming depending on the loan's payout mode).
export async function repayBorrowerDebt(
  tx: DbTx,
  args: {
    borrowerType: OwnerType;
    borrowerId: string;
    amountLzt: number;
    groupId?: string;
    refType?: string | null;
    refId?: string | null;
    // When set, repayment is targeted strictly at this single loan instead
    // of being applied oldest-first across all open loans. Used by the
    // borrower-initiated manual repay endpoint.
    onlyLoanId?: string;
  },
): Promise<number> {
  let remaining = Math.floor(args.amountLzt);
  if (remaining <= 0) return 0;

  const openLoans = await tx
    .select()
    .from(loansTable)
    .where(
      and(
        eq(loansTable.borrowerType, args.borrowerType),
        eq(loansTable.borrowerId, args.borrowerId),
        // Defaulted loans remain collectible — repayments continue to reduce
        // outstanding balance even after the due date has passed.
        sql`${loansTable.status} in ('active', 'defaulted')`,
        ...(args.onlyLoanId ? [eq(loansTable.id, args.onlyLoanId)] : []),
      ),
    )
    .orderBy(asc(loansTable.startedAt));

  let totalRepaid = 0;
  const groupId = args.groupId ?? randomUUID();

  for (const loan of openLoans) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, loan.outstandingLzt);
    if (slice <= 0) continue;
    remaining -= slice;
    totalRepaid += slice;
    const newOutstanding = loan.outstandingLzt - slice;
    const willClose = newOutstanding === 0;

    await tx
      .update(loansTable)
      .set({
        outstandingLzt: newOutstanding,
        repaidLzt: loan.repaidLzt + slice,
        ...(willClose
          ? { status: "repaid", closedAt: new Date() }
          : {}),
      })
      .where(eq(loansTable.id, loan.id));

    // Borrower side: debt aggregate down.
    await adjustUserBucket(
      tx,
      loan.borrowerType as OwnerType,
      loan.borrowerId,
      "debt",
      -slice,
    );
    await writeLedger(tx, [
      {
        groupId,
        kind: "loan_repay_borrower",
        ownerType: loan.borrowerType as OwnerType,
        ownerId: loan.borrowerId,
        bucket: "debt",
        deltaLzt: -slice,
        refType: "loan",
        refId: loan.id,
      },
    ]);

    // Lender side. Two payout modes.
    if (loan.lenderPayoutMode === "balance_streaming") {
      // Pay the lender now into balance (the lender opted for streaming).
      await adjustUserBucket(
        tx,
        loan.lenderType as OwnerType,
        loan.lenderId,
        "balance",
        slice,
      );
      await tx
        .update(userTable(loan.lenderType as OwnerType))
        .set({
          creditReceivableLzt: sql`${userTable(loan.lenderType as OwnerType).creditReceivableLzt} - ${slice}`,
        })
        .where(eq(userTable(loan.lenderType as OwnerType).id, loan.lenderId));
      await writeLedger(tx, [
        {
          groupId,
          kind: "loan_repay_lender",
          ownerType: loan.lenderType as OwnerType,
          ownerId: loan.lenderId,
          bucket: "balance",
          deltaLzt: slice,
          refType: "loan",
          refId: loan.id,
        },
      ]);
    } else {
      // cash_on_close: park the slice in the loan's escrow until full repayment,
      // but reduce the lender's `creditReceivableLzt` aggregate proportionally
      // so it always reflects live outstanding principal across all loans.
      await tx
        .update(loansTable)
        .set({ escrowLzt: sql`${loansTable.escrowLzt} + ${slice}` })
        .where(eq(loansTable.id, loan.id));
      await tx
        .update(userTable(loan.lenderType as OwnerType))
        .set({
          creditReceivableLzt: sql`GREATEST(${userTable(loan.lenderType as OwnerType).creditReceivableLzt} - ${slice}, 0)`,
        })
        .where(eq(userTable(loan.lenderType as OwnerType).id, loan.lenderId));
      await writeLedger(tx, [
        {
          groupId,
          kind: "loan_escrow_in",
          ownerType: "system",
          ownerId: null,
          bucket: "escrow",
          deltaLzt: slice,
          refType: "loan",
          refId: loan.id,
        },
      ]);
      if (willClose) {
        // Pay out the full escrow into the lender's cash bucket.
        const [updated] = await tx
          .select({ escrow: loansTable.escrowLzt })
          .from(loansTable)
          .where(eq(loansTable.id, loan.id));
        const payout = updated?.escrow ?? 0;
        if (payout > 0) {
          await tx
            .update(loansTable)
            .set({ escrowLzt: 0 })
            .where(eq(loansTable.id, loan.id));
          await adjustUserBucket(
            tx,
            loan.lenderType as OwnerType,
            loan.lenderId,
            "cash",
            payout,
          );
          // Receivable was already drawn down per-slice above, so no further
          // adjustment needed here on full close.
          await writeLedger(tx, [
            {
              groupId,
              kind: "loan_repay_lender_close",
              ownerType: loan.lenderType as OwnerType,
              ownerId: loan.lenderId,
              bucket: "cash",
              deltaLzt: payout,
              refType: "loan",
              refId: loan.id,
            },
            {
              groupId,
              kind: "loan_escrow_out",
              ownerType: "system",
              ownerId: null,
              bucket: "escrow",
              deltaLzt: -payout,
              refType: "loan",
              refId: loan.id,
            },
          ]);
        }
      }
    }
  }
  return totalRepaid;
}

// ---------------------------------------------------------------- deposits

// Apply a fully-detected on-chain deposit. The caller passes the USDT-equivalent
// gross amount in cents (1¢ = 0.01 USDT). We compute the platform commission
// using the tariff (with premium discount), credit it to the system fees +
// interest reserve, and split the remainder 50/50 into cash + balance.
//
// Returns the credited split and the new lifetime cents.
import {
  effectiveDepositRatePct,
  isPremiumActive,
  premiumGrantOnCross,
} from "./tariff";

export async function applyDepositCents(
  tx: DbTx,
  args: {
    // Dev keys skip the tariff/premium machinery entirely — see
    // creditDevKeyDeposit — so they are intentionally excluded here.
    ownerType: Exclude<OwnerType, "dev_key">;
    ownerId: string;
    grossUsdtCents: number;
    refType?: string | null;
    refId?: string | null;
  },
): Promise<{
  feeLzt: number;
  cashLzt: number;
  balanceLzt: number;
  newLifetimeCents: number;
  grantedFreePremium: boolean;
}> {
  const gross = Math.max(0, Math.floor(args.grossUsdtCents));
  if (gross <= 0) {
    return {
      feeLzt: 0,
      cashLzt: 0,
      balanceLzt: 0,
      newLifetimeCents: 0,
      grantedFreePremium: false,
    };
  }
  const tbl = userTable(args.ownerType);
  const [user] = await tx
    .select({
      lifetime: tbl.lifetimeDepositUsdtCents,
      premiumUntil: tbl.premiumUntil,
      maxDeposit: tbl.maxDepositUsdtCents,
    })
    .from(tbl)
    .where(eq(tbl.id, args.ownerId));
  if (!user) {
    throw new Error(`user ${args.ownerType}/${args.ownerId} not found`);
  }

  const ratePct = effectiveDepositRatePct({
    lifetimeUsdtCents: user.lifetime,
    premiumActive: isPremiumActive(user.premiumUntil),
  });
  // Convert gross cents → raw LZT (1 USDT = 200 LZT, so 1¢ = 2 LZT).
  const grossLzt = gross * 2;
  const feeLzt = Math.floor((grossLzt * ratePct) / 100);
  const netLzt = grossLzt - feeLzt;

  // Deposits follow the same payout-split law: when the depositor has open
  // debt, 40% of the net auto-repays loans, 40% goes to balance, 20% to cash.
  // Otherwise it's the standard 50/50 cash/balance.
  const balances = await getUserBalances(tx, args.ownerType, args.ownerId);
  const split = splitPayoutLzt(netLzt, balances?.debt ?? 0);
  const cashLzt = split.cash;
  const balanceLzt = split.balance;

  const groupId = randomUUID();

  // Credit user buckets.
  if (cashLzt > 0)
    await adjustUserBucket(tx, args.ownerType, args.ownerId, "cash", cashLzt);
  if (balanceLzt > 0)
    await adjustUserBucket(
      tx,
      args.ownerType,
      args.ownerId,
      "balance",
      balanceLzt,
    );
  if (split.debt > 0) {
    await repayBorrowerDebt(tx, {
      borrowerType: args.ownerType,
      borrowerId: args.ownerId,
      amountLzt: split.debt,
      groupId,
      refType: args.refType ?? "deposit",
      refId: args.refId ?? null,
    });
  }

  // Bump lifetime + max-deposit, grant free premium when crossing $15k.
  const newLifetime = user.lifetime + gross;
  const grant = premiumGrantOnCross(user.lifetime, newLifetime);
  const newMaxDeposit = Math.max(user.maxDeposit, gross);
  const update: Record<string, unknown> = {
    lifetimeDepositUsdtCents: newLifetime,
    maxDepositUsdtCents: newMaxDeposit,
  };
  if (grant) {
    const base = isPremiumActive(user.premiumUntil)
      ? new Date(user.premiumUntil as unknown as string)
      : new Date();
    const extended = new Date(
      base.getTime() + grant.freePremiumDays * 24 * 3600 * 1000,
    );
    update.premiumUntil = extended;
  }
  await tx.update(tbl).set(update).where(eq(tbl.id, args.ownerId));

  // Route the fee: 50% interest reserve, 50% platform fees (configurable, but
  // a fixed 50/50 split for v1 keeps the reserve growing alongside profits).
  const reserveCut = Math.floor(feeLzt / 2);
  const profitCut = feeLzt - reserveCut;
  if (reserveCut > 0) await adjustSystem(tx, SYSTEM_INTEREST_RESERVE, reserveCut);
  if (profitCut > 0) await adjustSystem(tx, SYSTEM_PLATFORM_FEES, profitCut);

  const rows: Parameters<typeof writeLedger>[1] = [];
  if (cashLzt > 0)
    rows.push({
      groupId,
      kind: "deposit_credit",
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      bucket: "cash",
      deltaLzt: cashLzt,
      refType: args.refType,
      refId: args.refId,
      note: `tariff ${ratePct}%`,
    });
  if (balanceLzt > 0)
    rows.push({
      groupId,
      kind: "deposit_credit",
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      bucket: "balance",
      deltaLzt: balanceLzt,
      refType: args.refType,
      refId: args.refId,
      note: `tariff ${ratePct}%`,
    });
  if (reserveCut > 0)
    rows.push({
      groupId,
      kind: "deposit_fee",
      ownerType: "system",
      ownerId: null,
      bucket: "reserve",
      deltaLzt: reserveCut,
      refType: "system_account",
      refId: SYSTEM_INTEREST_RESERVE,
    });
  if (profitCut > 0)
    rows.push({
      groupId,
      kind: "deposit_fee",
      ownerType: "system",
      ownerId: null,
      bucket: "reserve",
      deltaLzt: profitCut,
      refType: "system_account",
      refId: SYSTEM_PLATFORM_FEES,
    });
  await writeLedger(tx, rows);

  return {
    feeLzt,
    cashLzt,
    balanceLzt,
    newLifetimeCents: newLifetime,
    grantedFreePremium: !!grant,
  };
}

// Credit a dev-key wallet with an on-chain deposit. Simpler than
// applyDepositCents (which drives host/player tariff tiers and premium
// grants — concepts that don't apply to API-key wallets): dev keys always
// get the plain 50/50 cash/balance split with zero platform fee, since the
// deposit-worker rate limiting and tariff logic exists to discourage abuse
// by end users, not developer billing accounts.
export async function creditDevKeyDeposit(
  tx: DbTx,
  args: {
    devKeyId: string;
    grossUsdtCents: number;
    refType?: string | null;
    refId?: string | null;
  },
): Promise<{ cashLzt: number; balanceLzt: number; newLifetimeCents: number }> {
  const gross = Math.max(0, Math.floor(args.grossUsdtCents));
  if (gross <= 0) return { cashLzt: 0, balanceLzt: 0, newLifetimeCents: 0 };
  const grossLzt = gross * 2;

  const balances = await getUserBalances(tx, "dev_key", args.devKeyId);
  const split = splitPayoutLzt(grossLzt, balances?.debt ?? 0);
  const groupId = randomUUID();

  if (split.cash > 0)
    await adjustUserBucket(tx, "dev_key", args.devKeyId, "cash", split.cash);
  if (split.balance > 0)
    await adjustUserBucket(
      tx,
      "dev_key",
      args.devKeyId,
      "balance",
      split.balance,
    );

  await tx
    .update(devKeysTable)
    .set({
      lifetimeDepositUsdtCents: sql`${devKeysTable.lifetimeDepositUsdtCents} + ${gross}`,
    })
    .where(eq(devKeysTable.id, args.devKeyId));

  const rows: Parameters<typeof writeLedger>[1] = [];
  if (split.cash > 0)
    rows.push({
      groupId,
      kind: "deposit_credit",
      ownerType: "dev_key",
      ownerId: args.devKeyId,
      bucket: "cash",
      deltaLzt: split.cash,
      refType: args.refType,
      refId: args.refId,
    });
  if (split.balance > 0)
    rows.push({
      groupId,
      kind: "deposit_credit",
      ownerType: "dev_key",
      ownerId: args.devKeyId,
      bucket: "balance",
      deltaLzt: split.balance,
      refType: args.refType,
      refId: args.refId,
    });
  await writeLedger(tx, rows);

  const [row] = await tx
    .select({ lifetime: devKeysTable.lifetimeDepositUsdtCents })
    .from(devKeysTable)
    .where(eq(devKeysTable.id, args.devKeyId));

  return {
    cashLzt: split.cash,
    balanceLzt: split.balance,
    newLifetimeCents: row?.lifetime ?? gross,
  };
}

// ---------------------------------------------------------------- withdrawals

// Record a withdrawal debit (the withdrawal row itself is created by the
// caller — this just keeps the cash bucket and ledger consistent and bumps
// the lifetime-withdrawal stat).
export async function recordWithdrawalDebit(
  tx: DbTx,
  args: {
    // Dev-key withdrawals are out of scope for task-125 (key balance is
    // spend-only from the widget's perspective); exclude to keep the
    // maxWithdrawalUsdtCents stat column (host/player-only) type-safe.
    ownerType: Exclude<OwnerType, "dev_key">;
    ownerId: string;
    amountLzt: number;
    amountUsdtCents: number;
    refType?: string;
    refId?: string;
  },
): Promise<boolean> {
  const debited = await adjustUserBucket(
    tx,
    args.ownerType,
    args.ownerId,
    "cash",
    -args.amountLzt,
  );
  if (!debited) return false;
  const tbl = userTable(args.ownerType);
  await tx
    .update(tbl)
    .set({
      maxWithdrawalUsdtCents: sql`GREATEST(${tbl.maxWithdrawalUsdtCents}, ${args.amountUsdtCents})`,
    })
    .where(eq(tbl.id, args.ownerId));
  await writeLedger(tx, [
    {
      groupId: randomUUID(),
      kind: "withdrawal",
      ownerType: args.ownerType,
      ownerId: args.ownerId,
      bucket: "cash",
      deltaLzt: -args.amountLzt,
      refType: args.refType ?? "withdrawal",
      refId: args.refId ?? null,
    },
  ]);
  return true;
}

// ---------------------------------------------------------------- system

export async function systemAccountBalance(
  tx: DbTx,
  key: string,
): Promise<number> {
  const [row] = await tx
    .select({ b: systemAccountsTable.balanceLzt })
    .from(systemAccountsTable)
    .where(eq(systemAccountsTable.key, key));
  return row?.b ?? 0;
}

export async function drawFromSystemAccount(
  tx: DbTx,
  key: string,
  amount: number,
): Promise<boolean> {
  if (amount <= 0) return true;
  const updated = await tx
    .update(systemAccountsTable)
    .set({
      balanceLzt: sql`${systemAccountsTable.balanceLzt} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(systemAccountsTable.key, key),
        sql`${systemAccountsTable.balanceLzt} >= ${amount}`,
      ),
    )
    .returning({ key: systemAccountsTable.key });
  return updated.length > 0;
}

export { adjustUserBucket, adjustSystem, writeLedger };

// Pledger limit on P2P loan request size: max(largest_deposit, largest_withdrawal).
export function pledgerLimitLzt(args: {
  maxDepositUsdtCents: number;
  maxWithdrawalUsdtCents: number;
}): number {
  const cents = Math.max(args.maxDepositUsdtCents, args.maxWithdrawalUsdtCents);
  // 1¢ = 2 LZT
  return cents * 2;
}
