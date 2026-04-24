import { sql, eq, and } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  billingEventsTable,
} from "@workspace/db";

// Apply a one-time launch fee for a freshly-claimed session.
//
// Cash flow:
//   launchPriceUsd > 0  → player pays host
//   launchPriceUsd < 0  → host pays player ("loss-leader" promo)
//   launchPriceUsd = 0  → no-op
//
// The whole thing runs in a single DB transaction. Whichever side ends up
// being debited must have a non-negative balance after the change, otherwise
// we abort and return false (caller should reject the claim).
//
// We log it as a single billing_events row with `minutes = 0` so the
// dashboard activity feed and earnings reports automatically pick it up.
export async function applyLaunchFee(args: {
  sessionId: string;
  hostId: string;
  playerId: string;
  launchPriceUsd: number;
}): Promise<{ ok: boolean; reason?: string }> {
  const fee = args.launchPriceUsd;
  if (!Number.isFinite(fee) || fee === 0) return { ok: true };

  const playerDebit = fee; // signed
  const hostCredit = fee; // signed
  const playerDebitStr = playerDebit.toFixed(6);
  const hostCreditStr = hostCredit.toFixed(6);

  try {
    return await db.transaction(async (tx) => {
      // Player side: ensure balance covers a positive debit.
      if (playerDebit > 0) {
        const debited = await tx
          .update(playersTable)
          .set({
            creditBalance: sql`${playersTable.creditBalance} - ${playerDebitStr}::numeric`,
          })
          .where(
            and(
              eq(playersTable.id, args.playerId),
              sql`${playersTable.creditBalance} >= ${playerDebitStr}::numeric`,
            ),
          )
          .returning({ id: playersTable.id });
        if (debited.length === 0) {
          return { ok: false, reason: "Insufficient player balance for launch fee" };
        }
      } else {
        // Negative fee — credit the player instead.
        await tx
          .update(playersTable)
          .set({
            creditBalance: sql`${playersTable.creditBalance} - ${playerDebitStr}::numeric`,
          })
          .where(eq(playersTable.id, args.playerId));
      }

      // Host side.
      if (hostCredit < 0) {
        // Host pays — guard against going negative.
        const adjusted = await tx
          .update(hostsTable)
          .set({
            creditBalance: sql`${hostsTable.creditBalance} + ${hostCreditStr}::numeric`,
          })
          .where(
            and(
              eq(hostsTable.id, args.hostId),
              sql`${hostsTable.creditBalance} + ${hostCreditStr}::numeric >= 0`,
            ),
          )
          .returning({ id: hostsTable.id });
        if (adjusted.length === 0) {
          // Roll back via thrown error.
          throw new Error("Insufficient host balance for negative launch fee");
        }
      } else {
        await tx
          .update(hostsTable)
          .set({
            creditBalance: sql`${hostsTable.creditBalance} + ${hostCreditStr}::numeric`,
          })
          .where(eq(hostsTable.id, args.hostId));
      }

      await tx.insert(billingEventsTable).values({
        sessionId: args.sessionId,
        hostId: args.hostId,
        playerId: args.playerId,
        minutes: 0,
        playerDebit: playerDebitStr,
        hostCredit: hostCreditStr,
        commissionAmount: "0",
      });

      return { ok: true };
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Launch fee transaction failed",
    };
  }
}
