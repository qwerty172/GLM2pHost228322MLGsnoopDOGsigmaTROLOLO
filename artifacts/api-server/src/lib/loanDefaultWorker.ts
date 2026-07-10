// Marks loans whose dueAt is more than DEFAULT_GRACE_DAYS overdue as
// `defaulted`, flags the borrower's `hasDefault`, and releases any escrow
// already accrued to the lender. The loan record stays so it can later be
// listed for sale on the debts marketplace (out of scope here).

import { and, eq, lt, sql } from "drizzle-orm";
import { db, loansTable, hostsTable, playersTable } from "@workspace/db";
import { logger } from "./logger";
import { adjustUserBucket, writeLedger } from "./economy";
import { randomUUID } from "node:crypto";

const DEFAULT_GRACE_DAYS = 60;
const CHECK_INTERVAL_MS = Number(
  process.env["LOAN_DEFAULT_CHECK_MS"] ?? 6 * 3600 * 1000,
);
let interval: NodeJS.Timeout | null = null;
// Overlap guard: skip a tick if the previous run is still in flight.
let isTicking = false;

async function tick(now: Date = new Date()): Promise<void> {
  if (isTicking) return;
  isTicking = true;
  try {
    await tickInner(now);
  } finally {
    isTicking = false;
  }
}

async function tickInner(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(
    now.getTime() - DEFAULT_GRACE_DAYS * 24 * 3600 * 1000,
  );
  const overdue = await db
    .select()
    .from(loansTable)
    .where(
      and(eq(loansTable.status, "active"), lt(loansTable.dueAt, cutoff)),
    );

  for (const loan of overdue) {
    try {
      await db.transaction(async (tx) => {
        const lenderTbl =
          loan.lenderType === "host" ? hostsTable : playersTable;
        const borrowerTbl =
          loan.borrowerType === "host" ? hostsTable : playersTable;
        await tx
          .update(loansTable)
          .set({ status: "defaulted", defaultedAt: now })
          .where(eq(loansTable.id, loan.id));
        await tx
          .update(borrowerTbl)
          .set({ hasDefault: true })
          .where(eq(borrowerTbl.id, loan.borrowerId));
        // Release any sitting escrow to the lender as cash; debt stays on the
        // borrower so the debts marketplace can collect it later.
        if (loan.escrowLzt > 0) {
          const payout = loan.escrowLzt;
          await tx
            .update(loansTable)
            .set({ escrowLzt: 0 })
            .where(eq(loansTable.id, loan.id));
          await adjustUserBucket(
            tx,
            loan.lenderType as "host" | "player",
            loan.lenderId,
            "cash",
            payout,
          );
          // Do NOT touch `creditReceivableLzt` here — for cash_on_close loans
          // it was already drawn down per-slice during repayment, so it now
          // mirrors `outstandingLzt` (what the borrower still owes). The
          // escrow release moves prior-paid principal from system to lender
          // cash; the unpaid principal stays as a receivable until collected
          // via the debts marketplace.
          const groupId = randomUUID();
          await writeLedger(tx, [
            {
              groupId,
              kind: "loan_default_release",
              ownerType: loan.lenderType as "host" | "player",
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
      });
      logger.info({ loanId: loan.id }, "Loan marked defaulted");
    } catch (err) {
      logger.error({ err, loanId: loan.id }, "Failed to default loan");
    }
  }
}

export function startLoanDefaultWorker(): void {
  if (interval) return;
  if (process.env["LOAN_DEFAULT_WORKER"] === "off") return;
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, "Starting loan-default worker");
  interval = setInterval(() => {
    void tick().catch((err) =>
      logger.error({ err }, "Loan-default worker crashed"),
    );
  }, CHECK_INTERVAL_MS);
}

export function stopLoanDefaultWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { tick as runLoanDefaultCheckOnce };
