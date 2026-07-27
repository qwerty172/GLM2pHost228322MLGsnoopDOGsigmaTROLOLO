// Shared session billing helpers used by the billing worker, host-health
// worker, and session end routes — keeps minute counting and block refunds
// consistent across call sites.

import { and, eq, or, sql } from "drizzle-orm";
import {
  db,
  billingEventsTable,
  playersTable,
  sessionsTable,
  ledgerTable,
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

async function hasBlockRefundLedger(
  tx: Tx,
  sessionId: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ id: ledgerTable.id })
    .from(ledgerTable)
    .where(
      and(
        eq(ledgerTable.kind, "block_refund"),
        eq(ledgerTable.refType, "session"),
        eq(ledgerTable.refId, sessionId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function refundBlockRemainder(
  tx: Tx,
  session: typeof sessionsTable.$inferSelect,
  minutesUsed: number,
): Promise<void> {
  if (!session.blockMinutes || !session.blockReservedLzt || !session.claimedByPlayerId)
    return;
  if (await hasBlockRefundLedger(tx, session.id)) return;
  const costPerMinute = Math.round(session.blockReservedLzt / session.blockMinutes);
  const costUsed = minutesUsed * costPerMinute;
  const refundLzt = Math.max(0, session.blockReservedLzt - costUsed);
  if (refundLzt <= 0) return;

  // Determine which bucket was used (based on paymentSource). On "auto" we
  // prefer green, matching the claim-time reservation logic.
  const bucket = session.paymentSource === "blue" ? "balance" : "green";
  const col =
    bucket === "green"
      ? playersTable.withdrawableBalanceLzt
      : playersTable.internalBalanceLzt;
  await tx
    .update(playersTable)
    .set(
      bucket === "green"
        ? { withdrawableBalanceLzt: sql`${col} + ${refundLzt}` }
        : { internalBalanceLzt: sql`${col} + ${refundLzt}` },
    )
    .where(eq(playersTable.id, session.claimedByPlayerId));
  await writeLedger(tx, [
    {
      groupId: randomUUID(),
      kind: "block_refund",
      ownerType: "player",
      ownerId: session.claimedByPlayerId,
      bucket: bucket === "green" ? "cash" : "balance",
      deltaLzt: refundLzt,
      refType: "session",
      refId: session.id,
      note: `block refund: ${minutesUsed}/${session.blockMinutes} мин использовано`,
    },
  ]);
  logger.info(
    { sessionId: session.id, refundLzt, minutesUsed },
    "Block remainder refunded",
  );
}
