import { sql, eq, and } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  billingEventsTable,
} from "@workspace/db";
import { usdtToLztRound, pickPlayerBucket } from "./lzt";

// Apply a one-time launch fee for a freshly-claimed session.
//
// Cash flow (in LZT):
//   launchPriceUsd > 0  → player pays host (split 50/50 green/blue on host side)
//   launchPriceUsd < 0  → host pays player ("loss-leader" promo) — credited
//                          to the player's зелёный (withdrawable) bucket
//   launchPriceUsd = 0  → no-op
//
// For the positive case the player's debit comes from the bucket they chose
// for this session (preferring green when on "auto"). Two billing_events rows
// are inserted, one per bucket on the host side (matching the per-minute path).
export async function applyLaunchFee(args: {
  sessionId: string;
  hostId: string;
  playerId: string;
  launchPriceUsd: number;
  paymentSource: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const feeUsd = args.launchPriceUsd;
  if (!Number.isFinite(feeUsd) || feeUsd === 0) return { ok: true };
  const feeLzt = usdtToLztRound(Math.abs(feeUsd));
  if (feeLzt <= 0) return { ok: true };

  try {
    return await db.transaction(async (tx) => {
      if (feeUsd > 0) {
        // Player → host. Pick bucket from session preference.
        const [player] = await tx
          .select({
            green: playersTable.withdrawableBalanceLzt,
            blue: playersTable.internalBalanceLzt,
          })
          .from(playersTable)
          .where(eq(playersTable.id, args.playerId));
        const green = player?.green ?? 0;
        const blue = player?.blue ?? 0;
        const bucket = pickPlayerBucket(
          args.paymentSource,
          feeLzt,
          green,
          blue,
        );
        if (bucket === null) {
          return {
            ok: false,
            reason: "Insufficient LZT in selected bucket for launch fee",
          };
        }

        const playerCol =
          bucket === "green"
            ? playersTable.withdrawableBalanceLzt
            : playersTable.internalBalanceLzt;

        const debited = await tx
          .update(playersTable)
          .set(
            bucket === "green"
              ? {
                  withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${feeLzt}`,
                }
              : {
                  internalBalanceLzt: sql`${playersTable.internalBalanceLzt} - ${feeLzt}`,
                },
          )
          .where(
            and(
              eq(playersTable.id, args.playerId),
              sql`${playerCol} >= ${feeLzt}`,
            ),
          )
          .returning({ id: playersTable.id });
        if (debited.length === 0) {
          return { ok: false, reason: "Insufficient player balance for launch fee" };
        }

        const hostGreen = Math.ceil(feeLzt / 2);
        const hostBlue = Math.floor(feeLzt / 2);
        if (hostGreen > 0) {
          await tx
            .update(hostsTable)
            .set({
              withdrawableBalanceLzt: sql`${hostsTable.withdrawableBalanceLzt} + ${hostGreen}`,
            })
            .where(eq(hostsTable.id, args.hostId));
        }
        if (hostBlue > 0) {
          await tx
            .update(hostsTable)
            .set({
              internalBalanceLzt: sql`${hostsTable.internalBalanceLzt} + ${hostBlue}`,
            })
            .where(eq(hostsTable.id, args.hostId));
        }

        await tx.insert(billingEventsTable).values([
          {
            sessionId: args.sessionId,
            hostId: args.hostId,
            playerId: args.playerId,
            minutes: 0,
            bucket: "green",
            playerDebitLzt: bucket === "green" ? feeLzt : 0,
            hostCreditLzt: hostGreen,
          },
          {
            sessionId: args.sessionId,
            hostId: args.hostId,
            playerId: args.playerId,
            minutes: 0,
            bucket: "blue",
            playerDebitLzt: bucket === "blue" ? feeLzt : 0,
            hostCreditLzt: hostBlue,
          },
        ]);
        return { ok: true };
      } else {
        // Host → player ("loss-leader"). Take from host's зелёный first, then
        // синий if needed; credit it all to player's зелёный bucket.
        const [hb] = await tx
          .select({
            green: hostsTable.withdrawableBalanceLzt,
            blue: hostsTable.internalBalanceLzt,
          })
          .from(hostsTable)
          .where(eq(hostsTable.id, args.hostId));
        const hg = hb?.green ?? 0;
        const hbl = hb?.blue ?? 0;
        if (hg + hbl < feeLzt) {
          throw new Error("Insufficient host balance for negative launch fee");
        }
        const takeGreen = Math.min(hg, feeLzt);
        const takeBlue = feeLzt - takeGreen;
        if (takeGreen > 0) {
          await tx
            .update(hostsTable)
            .set({
              withdrawableBalanceLzt: sql`${hostsTable.withdrawableBalanceLzt} - ${takeGreen}`,
            })
            .where(eq(hostsTable.id, args.hostId));
        }
        if (takeBlue > 0) {
          await tx
            .update(hostsTable)
            .set({
              internalBalanceLzt: sql`${hostsTable.internalBalanceLzt} - ${takeBlue}`,
            })
            .where(eq(hostsTable.id, args.hostId));
        }
        await tx
          .update(playersTable)
          .set({
            withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} + ${feeLzt}`,
          })
          .where(eq(playersTable.id, args.playerId));

        await tx.insert(billingEventsTable).values({
          sessionId: args.sessionId,
          hostId: args.hostId,
          playerId: args.playerId,
          minutes: 0,
          bucket: "green",
          playerDebitLzt: -feeLzt,
          hostCreditLzt: -feeLzt,
        });
        return { ok: true };
      }
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Launch fee transaction failed",
    };
  }
}
