import { eq } from "drizzle-orm";
import { db, hostsTable, playersTable } from "@workspace/db";
import { usdtToLztRound, pickPlayerBucket } from "./lzt";
import {
  adjustUserBucket,
  creditPayoutToUser,
  payInternal,
  writeLedger,
} from "./economy";
import { randomUUID } from "node:crypto";

// Apply a one-time launch fee for a freshly-claimed session.
//
// Cash flow (in LZT):
//   launchPriceUsd > 0  → player pays host. Routed through the central economy
//                         module so the host's payout is automatically split
//                         50/50 or 40/40/20 depending on the host's debt.
//   launchPriceUsd < 0  → host pays player ("loss-leader" promo). Taken from
//                         the host's зелёный first, then синий if needed,
//                         credited via creditPayoutToUser (debt-aware split).
//   launchPriceUsd = 0  → no-op
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
        const result = await payInternal(tx, {
          fromType: "player",
          fromId: args.playerId,
          toType: "host",
          toId: args.hostId,
          amountLzt: feeLzt,
          source: bucket === "green" ? "cash" : "balance",
          kind: "launch_fee",
          refType: "session",
          refId: args.sessionId,
        });
        if (!result.ok) return { ok: false, reason: result.reason };
        return { ok: true };
      }

      // Negative fee: host → player.
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
        return {
          ok: false,
          reason: "Insufficient host balance for negative launch fee",
        };
      }
      const takeGreen = Math.min(hg, feeLzt);
      const takeBlue = feeLzt - takeGreen;
      const groupId = randomUUID();
      if (takeGreen > 0) {
        await adjustUserBucket(tx, "host", args.hostId, "cash", -takeGreen);
        await writeLedger(tx, [
          {
            groupId,
            kind: "launch_promo_host",
            ownerType: "host",
            ownerId: args.hostId,
            bucket: "cash",
            deltaLzt: -takeGreen,
            refType: "session",
            refId: args.sessionId,
          },
        ]);
      }
      if (takeBlue > 0) {
        await adjustUserBucket(tx, "host", args.hostId, "balance", -takeBlue);
        await writeLedger(tx, [
          {
            groupId,
            kind: "launch_promo_host",
            ownerType: "host",
            ownerId: args.hostId,
            bucket: "balance",
            deltaLzt: -takeBlue,
            refType: "session",
            refId: args.sessionId,
          },
        ]);
      }
      await creditPayoutToUser(tx, {
        ownerType: "player",
        ownerId: args.playerId,
        amountLzt: feeLzt,
        kind: "launch_promo_player",
        refType: "session",
        refId: args.sessionId,
        groupId,
      });
      return { ok: true };
    });
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error ? err.message : "Launch fee transaction failed",
    };
  }
}
