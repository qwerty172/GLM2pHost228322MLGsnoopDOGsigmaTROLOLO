// Premium subscription. Paid in LZT from `internalBalanceLzt` (the синий
// bucket). 600 LZT = $3 = 1 day. Extends `premiumUntil` from the larger of
// `now` and the current `premiumUntil`.

import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, hostsTable, playersTable } from "@workspace/db";
import { resolveOwnerByToken } from "../lib/walletOwner";
import {
  adjustSystem,
  SYSTEM_PLATFORM_FEES,
  writeLedger,
  type OwnerType,
} from "../lib/economy";
import { rateLimit } from "../lib/rateLimit";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();
const purchaseLimiter = rateLimit({
  scope: "premium:purchase",
  windowMs: 60_000,
  max: 4,
});
const PREMIUM_LZT_PER_DAY = 600;

function userTbl(t: OwnerType) {
  return t === "host" ? hostsTable : playersTable;
}

router.post("/premium/purchase", purchaseLimiter, async (req, res): Promise<void> => {
  const userToken = String(req.body?.userToken ?? "");
  const days = Math.floor(Number(req.body?.days));
  if (!userToken || !Number.isFinite(days) || days <= 0 || days > 365 * 5) {
    res.status(400).json({ error: "userToken and 1..1825 days required" });
    return;
  }
  const owner = await resolveOwnerByToken(userToken);
  if (!owner) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const cost = days * PREMIUM_LZT_PER_DAY;
  try {
    const result = await db.transaction(async (tx) => {
      const tbl = userTbl(owner.type);
      const debited = await tx
        .update(tbl)
        .set({
          internalBalanceLzt: sql`${tbl.internalBalanceLzt} - ${cost}`,
        })
        .where(
          eq(tbl.id, owner.id),
        )
        .returning({
          balance: tbl.internalBalanceLzt,
          premiumUntil: tbl.premiumUntil,
        });
      // Re-check post-update; if it went negative, abort the tx.
      if (!debited[0] || debited[0].balance < 0) {
        throw new Error("Insufficient balance");
      }
      const now = new Date();
      const base =
        debited[0].premiumUntil && debited[0].premiumUntil > now
          ? debited[0].premiumUntil
          : now;
      const newUntil = new Date(base.getTime() + days * 24 * 3600 * 1000);
      await tx
        .update(tbl)
        .set({ premiumUntil: newUntil })
        .where(eq(tbl.id, owner.id));
      await adjustSystem(tx, SYSTEM_PLATFORM_FEES, cost);
      const groupId = randomUUID();
      await writeLedger(tx, [
        {
          groupId,
          kind: "premium_purchase",
          ownerType: owner.type,
          ownerId: owner.id,
          bucket: "balance",
          deltaLzt: -cost,
          refType: "premium",
          refId: null,
          note: `${days}d`,
        },
        {
          groupId,
          kind: "premium_purchase",
          ownerType: "system",
          ownerId: null,
          bucket: "reserve",
          deltaLzt: cost,
          refType: "system_account",
          refId: SYSTEM_PLATFORM_FEES,
        },
      ]);
      return { premiumUntil: newUntil.toISOString(), costLzt: cost };
    });
    res.status(201).json(result);
  } catch (err) {
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Purchase failed" });
  }
});

export default router;
