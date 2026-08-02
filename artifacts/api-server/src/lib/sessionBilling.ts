// Shared session billing helpers used by the billing worker, host-health
// worker, and session end routes — keeps minute counting and block refunds
// consistent across call sites.

import { and, eq, or, sql } from "drizzle-orm";
import {
  db,
  billingEventsTable,
  ledgerTable,
  playersTable,
  sessionsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { writeLedger } from "./economy";
import { randomUUID } from "node:crypto";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Minutes already billed for a session.
 *
 * Each paid tick inserts two `session_tick` rows (green + blue); counting only
 * `bucket=green` avoids 2× inflation. Host-service credit ticks
 * (`session_tick_credit`) also consume a block minute and must be included —
 * otherwise block sessions never expire while on credit.
 */
export async function countSessionMinutesUsed(
  tx: Tx | typeof db,
  sessionId: string,
): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(billingEventsTable)
    .where(
      and(
        eq(billingEventsTable.sessionId, sessionId),
        or(
          and(
            eq(billingEventsTable.kind, "session_tick"),
            eq(billingEventsTable.bucket, "green"),
          ),
          eq(billingEventsTable.kind, "session_tick_credit"),
        ),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Split a refund across buckets proportional to block_reserve ledger debits. */
export function splitRefundByReserveBuckets(
  refundLzt: number,
  reservedCash: number,
  reservedBalance: number,
): { cash: number; balance: number } {
  const total = reservedCash + reservedBalance;
  if (refundLzt <= 0 || total <= 0) return { cash: 0, balance: 0 };
  const cash = Math.round((refundLzt * reservedCash) / total);
  return { cash, balance: refundLzt - cash };
}

async function blockReserveByBucket(
  tx: Tx,
  sessionId: string,
  playerId: string,
): Promise<{ cash: number; balance: number }> {
  const rows = await tx
    .select({ bucket: ledgerTable.bucket, deltaLzt: ledgerTable.deltaLzt })
    .from(ledgerTable)
    .where(
      and(
        eq(ledgerTable.kind, "block_reserve"),
        eq(ledgerTable.ownerType, "player"),
        eq(ledgerTable.ownerId, playerId),
        eq(ledgerTable.refType, "session"),
        eq(ledgerTable.refId, sessionId),
      ),
    );
  let cash = 0;
  let balance = 0;
  for (const row of rows) {
    const amount = -row.deltaLzt;
    if (row.bucket === "cash") cash += amount;
    else if (row.bucket === "balance") balance += amount;
  }
  return { cash, balance };
}

export async function refundBlockRemainder(
  tx: Tx,
  session: typeof sessionsTable.$inferSelect,
  minutesUsed: number,
): Promise<void> {
  // Re-read inside the transaction — callers often pass a stale snapshot
  // (e.g. after renew-block bumped blockMinutes / blockReservedLzt).
  const [fresh] = await tx
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, session.id));
  if (
    !fresh?.blockMinutes ||
    !fresh.blockReservedLzt ||
    !fresh.claimedByPlayerId
  ) {
    return;
  }

  const costPerMinute = Math.round(
    fresh.blockReservedLzt / fresh.blockMinutes,
  );
  const costUsed = minutesUsed * costPerMinute;
  const refundLzt = Math.max(0, fresh.blockReservedLzt - costUsed);
  if (refundLzt <= 0) return;

  const reserved = await blockReserveByBucket(
    tx,
    fresh.id,
    fresh.claimedByPlayerId,
  );
  const totalReserved = reserved.cash + reserved.balance;

  let refundCash = 0;
  let refundBalance = 0;
  if (totalReserved > 0) {
    const split = splitRefundByReserveBuckets(
      refundLzt,
      reserved.cash,
      reserved.balance,
    );
    refundCash = split.cash;
    refundBalance = split.balance;
  } else {
    // Legacy sessions without block_reserve ledger rows.
    const bucket = fresh.paymentSource === "blue" ? "balance" : "green";
    if (bucket === "green") refundCash = refundLzt;
    else refundBalance = refundLzt;
  }

  const ledgerLegs: Parameters<typeof writeLedger>[1] = [];
  const groupId = randomUUID();

  if (refundCash > 0) {
    await tx
      .update(playersTable)
      .set({
        withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} + ${refundCash}`,
      })
      .where(eq(playersTable.id, fresh.claimedByPlayerId));
    ledgerLegs.push({
      groupId,
      kind: "block_refund",
      ownerType: "player",
      ownerId: fresh.claimedByPlayerId,
      bucket: "cash",
      deltaLzt: refundCash,
      refType: "session",
      refId: fresh.id,
      note: `block refund: ${minutesUsed}/${fresh.blockMinutes} мин использовано`,
    });
  }

  if (refundBalance > 0) {
    await tx
      .update(playersTable)
      .set({
        internalBalanceLzt: sql`${playersTable.internalBalanceLzt} + ${refundBalance}`,
      })
      .where(eq(playersTable.id, fresh.claimedByPlayerId));
    ledgerLegs.push({
      groupId,
      kind: "block_refund",
      ownerType: "player",
      ownerId: fresh.claimedByPlayerId,
      bucket: "balance",
      deltaLzt: refundBalance,
      refType: "session",
      refId: fresh.id,
      note: `block refund: ${minutesUsed}/${fresh.blockMinutes} мин использовано`,
    });
  }

  if (ledgerLegs.length > 0) {
    await writeLedger(tx, ledgerLegs);
  }

  logger.info(
    {
      sessionId: fresh.id,
      refundLzt,
      refundCash,
      refundBalance,
      minutesUsed,
    },
    "Block remainder refunded",
  );
}
