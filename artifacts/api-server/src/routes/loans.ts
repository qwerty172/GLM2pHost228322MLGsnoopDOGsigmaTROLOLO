// P2P loan marketplace API. Surface is intentionally small for v1:
//   POST /loans/requests              — create a loan request (Pledger-limited)
//   GET  /loans/requests              — open requests, newest first
//   POST /loans/requests/:id/fund     — lender funds an open request
//   GET  /loans/mine                  — caller's active+historical loans
//   POST /loans/:id/repay             — manual borrower repayment

import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  loansTable,
  loanRequestsTable,
} from "@workspace/db";
import { resolveOwnerByToken } from "../lib/walletOwner";
import {
  adjustSystem,
  adjustUserBucket,
  pledgerLimitLzt,
  repayBorrowerDebt,
  SYSTEM_PLATFORM_FEES,
  writeLedger,
  type OwnerType,
} from "../lib/economy";
import { rateLimit } from "../lib/rateLimit";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// Anti-fraud rate limits on the credit-market mutation endpoints.
const writeLimiter = rateLimit({
  scope: "loans:write",
  windowMs: 60_000,
  max: 6,
});
const fundLimiter = rateLimit({
  scope: "loans:fund",
  windowMs: 60_000,
  max: 6,
});

// Platform anti-wash fee on every fresh P2P loan disbursal (2% of principal).
const LOAN_PLATFORM_FEE_BPS = 200;
const MIN_TERM_DAYS = 60;

function userTbl(t: OwnerType) {
  return t === "host" ? hostsTable : playersTable;
}

router.post("/loans/requests", writeLimiter, async (req, res): Promise<void> => {
  const userToken = String(req.body?.userToken ?? "");
  const amountLzt = Math.floor(Number(req.body?.amountLzt));
  const termDays = Math.floor(Number(req.body?.termDays));
  const rateBps = Math.max(0, Math.floor(Number(req.body?.rateBps ?? 0)));
  if (!userToken || !Number.isFinite(amountLzt) || amountLzt <= 0) {
    res.status(400).json({ error: "userToken and positive amountLzt required" });
    return;
  }
  if (!Number.isFinite(termDays) || termDays < MIN_TERM_DAYS) {
    res
      .status(400)
      .json({ error: `termDays must be ≥ ${MIN_TERM_DAYS}` });
    return;
  }
  const owner = await resolveOwnerByToken(userToken);
  if (!owner) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Pledger limit: brand-new users (no deposit, no withdrawal) → 0 ⇒ 403.
  const tbl = userTbl(owner.type);
  const [u] = await db
    .select({
      maxDep: tbl.maxDepositUsdtCents,
      maxWd: tbl.maxWithdrawalUsdtCents,
    })
    .from(tbl)
    .where(eq(tbl.id, owner.id));
  const limit = pledgerLimitLzt({
    maxDepositUsdtCents: u?.maxDep ?? 0,
    maxWithdrawalUsdtCents: u?.maxWd ?? 0,
  });
  if (limit <= 0) {
    res.status(403).json({
      error:
        "Pledger limit is 0 — make at least one deposit or withdrawal before requesting a P2P loan",
    });
    return;
  }
  if (amountLzt > limit) {
    res
      .status(400)
      .json({ error: `amountLzt exceeds Pledger limit of ${limit} LZT` });
    return;
  }

  const [request] = await db
    .insert(loanRequestsTable)
    .values({
      borrowerType: owner.type,
      borrowerId: owner.id,
      amountLzt,
      termDays,
      rateBps,
      status: "open",
    })
    .returning();

  res.status(201).json(request);
});

router.get("/loans/requests", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(loanRequestsTable)
    .where(eq(loanRequestsTable.status, "open"))
    .orderBy(desc(loanRequestsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/loans/requests/:id/fund", fundLimiter, async (req, res): Promise<void> => {
  const requestId = String(req.params.id);
  const userToken = String(req.body?.userToken ?? "");
  const fromSource = String(req.body?.source ?? "cash"); // "cash" | "balance"
  const payoutMode = String(req.body?.payoutMode ?? "cash_on_close");
  if (!userToken) {
    res.status(400).json({ error: "userToken required" });
    return;
  }
  if (fromSource !== "cash" && fromSource !== "balance") {
    res.status(400).json({ error: "source must be cash or balance" });
    return;
  }
  if (
    payoutMode !== "cash_on_close" &&
    payoutMode !== "balance_streaming"
  ) {
    res.status(400).json({ error: "invalid payoutMode" });
    return;
  }
  const lender = await resolveOwnerByToken(userToken);
  if (!lender) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Atomically claim the request: only one concurrent funder can flip it
      // from 'open' → 'funding'. Losers see 0 rows and bail out before any
      // money moves, preventing the double-funding race.
      const claimed = await tx
        .update(loanRequestsTable)
        .set({ status: "funding", updatedAt: new Date() })
        .where(
          and(
            eq(loanRequestsTable.id, requestId),
            eq(loanRequestsTable.status, "open"),
          ),
        )
        .returning();
      const request = claimed[0];
      if (!request) throw new Error("Request not open");
      if (
        request.borrowerType === lender.type &&
        request.borrowerId === lender.id
      ) {
        // Throw rolls back the whole tx — including the 'funding' flip — so
        // the request returns to 'open' automatically.
        throw new Error("Cannot fund your own request");
      }

      const principal = request.amountLzt;
      const lenderTbl = userTbl(lender.type);
      const debited = await adjustUserBucket(
        tx,
        lender.type,
        lender.id,
        fromSource as "cash" | "balance",
        -principal,
      );
      if (!debited) throw new Error("Insufficient lender balance");

      // Platform fee comes off the borrower's disbursal.
      const fee = Math.floor((principal * LOAN_PLATFORM_FEE_BPS) / 10_000);
      const disbursed = principal - fee;

      // Credit borrower cash bucket with disbursed amount.
      await adjustUserBucket(
        tx,
        request.borrowerType as OwnerType,
        request.borrowerId,
        "cash",
        disbursed,
      );
      // Add the loan principal (NOT the disbursal — the borrower still owes
      // the full amount) to their debt aggregate.
      await adjustUserBucket(
        tx,
        request.borrowerType as OwnerType,
        request.borrowerId,
        "debt",
        principal,
      );
      // Lender's receivable aggregate grows by the full principal.
      await tx
        .update(lenderTbl)
        .set({
          creditReceivableLzt: sql`${lenderTbl.creditReceivableLzt} + ${principal}`,
        })
        .where(eq(lenderTbl.id, lender.id));
      if (fee > 0) await adjustSystem(tx, SYSTEM_PLATFORM_FEES, fee);

      const dueAt = new Date(
        Date.now() + request.termDays * 24 * 3600 * 1000,
      );
      const [loan] = await tx
        .insert(loansTable)
        .values({
          loanType: "p2p",
          lenderType: lender.type,
          lenderId: lender.id,
          borrowerType: request.borrowerType,
          borrowerId: request.borrowerId,
          requestId: request.id,
          principalLzt: principal,
          outstandingLzt: principal,
          repaidLzt: 0,
          escrowLzt: 0,
          platformFeeLzt: fee,
          rateBps: request.rateBps,
          lenderPayoutMode: payoutMode,
          status: "active",
          dueAt,
        })
        .returning();
      if (!loan) throw new Error("Failed to create loan");

      await tx
        .update(loanRequestsTable)
        .set({
          status: "funded",
          fundedLoanId: loan.id,
          updatedAt: new Date(),
        })
        .where(eq(loanRequestsTable.id, request.id));

      const groupId = randomUUID();
      await writeLedger(tx, [
        {
          groupId,
          kind: "loan_disburse_lender",
          ownerType: lender.type,
          ownerId: lender.id,
          bucket: fromSource as "cash" | "balance",
          deltaLzt: -principal,
          refType: "loan",
          refId: loan.id,
        },
        {
          groupId,
          kind: "loan_disburse_borrower",
          ownerType: request.borrowerType as OwnerType,
          ownerId: request.borrowerId,
          bucket: "cash",
          deltaLzt: disbursed,
          refType: "loan",
          refId: loan.id,
        },
        {
          groupId,
          kind: "loan_disburse_borrower_debt",
          ownerType: request.borrowerType as OwnerType,
          ownerId: request.borrowerId,
          bucket: "debt",
          deltaLzt: principal,
          refType: "loan",
          refId: loan.id,
        },
        ...(fee > 0
          ? [
              {
                groupId,
                kind: "loan_fee",
                ownerType: "system" as const,
                ownerId: null,
                bucket: "reserve" as const,
                deltaLzt: fee,
                refType: "system_account",
                refId: SYSTEM_PLATFORM_FEES,
              },
            ]
          : []),
      ]);
      return { loan };
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Funding failed",
    });
  }
});

router.get("/loans/mine", async (req, res): Promise<void> => {
  const userToken = String(req.query.userToken ?? "");
  if (!userToken) {
    res.status(400).json({ error: "userToken required" });
    return;
  }
  const owner = await resolveOwnerByToken(userToken);
  if (!owner) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const asBorrower = await db
    .select()
    .from(loansTable)
    .where(
      and(
        eq(loansTable.borrowerType, owner.type),
        eq(loansTable.borrowerId, owner.id),
      ),
    )
    .orderBy(desc(loansTable.startedAt))
    .limit(100);
  const asLender = await db
    .select()
    .from(loansTable)
    .where(
      and(
        eq(loansTable.lenderType, owner.type),
        eq(loansTable.lenderId, owner.id),
      ),
    )
    .orderBy(desc(loansTable.startedAt))
    .limit(100);
  res.json({ asBorrower, asLender });
});

router.post("/loans/:id/repay", writeLimiter, async (req, res): Promise<void> => {
  const loanId = String(req.params.id);
  const userToken = String(req.body?.userToken ?? "");
  const amountLzt = Math.floor(Number(req.body?.amountLzt));
  const source = String(req.body?.source ?? "cash");
  if (!userToken || !Number.isFinite(amountLzt) || amountLzt <= 0) {
    res.status(400).json({ error: "userToken and positive amountLzt required" });
    return;
  }
  if (source !== "cash" && source !== "balance") {
    res.status(400).json({ error: "source must be cash or balance" });
    return;
  }
  const owner = await resolveOwnerByToken(userToken);
  if (!owner) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [loan] = await tx
        .select()
        .from(loansTable)
        .where(eq(loansTable.id, loanId));
      if (!loan) throw new Error("Loan not found");
      if (
        loan.borrowerType !== owner.type ||
        loan.borrowerId !== owner.id
      ) {
        throw new Error("Not your loan");
      }
      if (loan.status !== "active" && loan.status !== "defaulted") {
        throw new Error("Loan not repayable");
      }
      const amount = Math.min(amountLzt, loan.outstandingLzt);
      const debited = await adjustUserBucket(
        tx,
        owner.type,
        owner.id,
        source as "cash" | "balance",
        -amount,
      );
      if (!debited) throw new Error("Insufficient balance");
      const groupId = randomUUID();
      await writeLedger(tx, [
        {
          groupId,
          kind: "loan_repay_manual",
          ownerType: owner.type,
          ownerId: owner.id,
          bucket: source as "cash" | "balance",
          deltaLzt: -amount,
          refType: "loan",
          refId: loan.id,
        },
      ]);
      // Funnel through the standard repayment pipeline (handles escrow,
      // streaming, status close, etc.).
      const repaid = await repayBorrowerDebt(tx, {
        borrowerType: owner.type,
        borrowerId: owner.id,
        amountLzt: amount,
        groupId,
        refType: "loan",
        refId: loan.id,
        // Manual repayment targets the specific loan the user picked —
        // never spill into other loans they happen to also owe on.
        onlyLoanId: loan.id,
      });
      return { repaidLzt: repaid };
    });
    res.json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Repay failed" });
  }
});

export default router;
