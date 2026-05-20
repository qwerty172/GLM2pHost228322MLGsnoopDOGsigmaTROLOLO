import { Router, type IRouter } from "express";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  withdrawalsTable,
  depositsTable,
  billingEventsTable,
} from "@workspace/db";
import {
  GetWalletParams,
  GetWalletResponse,
  RequestWithdrawalParams,
  RequestWithdrawalBody,
  ListWalletTransactionsParams,
} from "@workspace/api-zod";
import {
  resolveOwnerByToken,
  ensureDepositAddressesForOwner,
  type OwnerType,
} from "../lib/walletOwner";
import { LZT_PER_USDT, lztToUsdt, usdtToLzt } from "../lib/lzt";

const router: IRouter = Router();

function ownerBalanceTable(type: OwnerType) {
  return type === "host" ? hostsTable : playersTable;
}

router.get("/wallet/:userToken", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const owner = await resolveOwnerByToken(params.data.userToken);
  if (!owner) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const addresses = await ensureDepositAddressesForOwner(owner.type, owner.id);

  const recent = await db
    .select()
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.ownerType, owner.type),
        eq(withdrawalsTable.ownerId, owner.id),
      ),
    )
    .orderBy(desc(withdrawalsTable.requestedAt))
    .limit(10);

  // `withdrawals.amount` is stored in crypto-USDT units; total pending in LZT
  // for the wallet headline.
  const pendingTotalRows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}), 0)`,
    })
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.ownerType, owner.type),
        eq(withdrawalsTable.ownerId, owner.id),
        inArray(withdrawalsTable.status, ["pending", "processing"]),
      ),
    );
  const pendingUsdt = Number(pendingTotalRows[0]?.total ?? 0);
  const pendingWithdrawalsLzt = usdtToLzt(pendingUsdt);

  res.json(
    GetWalletResponse.parse({
      ownerType: owner.type,
      ownerId: owner.id,
      displayName: owner.displayName,
      internalBalanceLzt: owner.internalBalanceLzt,
      withdrawableBalanceLzt: owner.withdrawableBalanceLzt,
      pendingWithdrawalsLzt,
      lztPerUsdt: LZT_PER_USDT,
      depositAddresses: addresses.map((a) => ({
        currency: a.currency,
        label: a.label,
        address: a.address,
        network: a.network,
        minDeposit: Number(a.minDeposit),
      })),
      recentWithdrawals: recent.map((w) => ({
        id: w.id,
        ownerType: w.ownerType,
        ownerId: w.ownerId,
        currency: w.currency,
        address: w.address,
        amountUsdt: Number(w.amount),
        amountLzt: usdtToLzt(Number(w.amount)),
        status: w.status,
        requestedAt: new Date(w.requestedAt).toISOString(),
        completedAt: w.completedAt
          ? new Date(w.completedAt).toISOString()
          : null,
      })),
    }),
  );
});

router.get(
  "/wallet/:userToken/transactions",
  async (req, res): Promise<void> => {
    const params = ListWalletTransactionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owner = await resolveOwnerByToken(params.data.userToken);
    if (!owner) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const deposits = await db
      .select()
      .from(depositsTable)
      .where(
        and(
          eq(depositsTable.ownerType, owner.type),
          eq(depositsTable.ownerId, owner.id),
        ),
      )
      .orderBy(desc(depositsTable.detectedAt))
      .limit(50);

    const withdrawals = await db
      .select()
      .from(withdrawalsTable)
      .where(
        and(
          eq(withdrawalsTable.ownerType, owner.type),
          eq(withdrawalsTable.ownerId, owner.id),
        ),
      )
      .orderBy(desc(withdrawalsTable.requestedAt))
      .limit(50);

    const billingFilter =
      owner.type === "host"
        ? eq(billingEventsTable.hostId, owner.id)
        : eq(billingEventsTable.playerId, owner.id);

    const billing = await db
      .select()
      .from(billingEventsTable)
      .where(billingFilter)
      .orderBy(desc(billingEventsTable.billedAt))
      .limit(50);

    type Tx = {
      id: string;
      kind: string;
      currency: string | null;
      amountLzt: number;
      status: string | null;
      description: string;
      timestamp: string;
    };
    const txs: Tx[] = [];

    for (const d of deposits) {
      const netUsdt = Number(d.netAmount);
      txs.push({
        id: `dep-${d.id}`,
        kind: "deposit",
        currency: d.currency,
        amountLzt: usdtToLzt(netUsdt),
        status: d.status,
        description: `${d.currency} deposit (net ≈ ${netUsdt} USDT)`,
        timestamp: new Date(d.detectedAt).toISOString(),
      });
    }
    for (const w of withdrawals) {
      const wUsdt = Number(w.amount);
      txs.push({
        id: `wd-${w.id}`,
        kind: "withdrawal",
        currency: w.currency,
        amountLzt: -usdtToLzt(wUsdt),
        status: w.status,
        description: `Withdraw to ${w.address.slice(0, 14)}…`,
        timestamp: new Date(w.requestedAt).toISOString(),
      });
    }
    for (const b of billing) {
      const amountLzt =
        owner.type === "host" ? b.hostCreditLzt : -b.playerDebitLzt;
      if (amountLzt === 0) continue;
      txs.push({
        id: `bill-${b.id}`,
        kind: "session_billing",
        currency: `LZT/${b.bucket}`,
        amountLzt,
        status: null,
        description:
          owner.type === "host"
            ? `Earned from session — ${b.bucket} (${b.minutes} min)`
            : `Played session (${b.minutes} min) — ${b.bucket}`,
        timestamp: new Date(b.billedAt).toISOString(),
      });
    }

    txs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    res.json(txs.slice(0, 50));
  },
);

router.post(
  "/wallet/:userToken/withdraw",
  async (req, res): Promise<void> => {
    const params = RequestWithdrawalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = RequestWithdrawalBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const amountLzt = Math.floor(body.data.amountLzt);
    if (!Number.isFinite(amountLzt) || amountLzt <= 0) {
      res.status(400).json({ error: "amountLzt must be a positive integer" });
      return;
    }
    const owner = await resolveOwnerByToken(params.data.userToken);
    if (!owner) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const balanceTable = ownerBalanceTable(owner.type);
    const amountUsdt = lztToUsdt(amountLzt);
    const amountUsdtStr = amountUsdt.toFixed(6);

    // Withdrawals only consume the зелёный (withdrawable) bucket.
    const debited = await db
      .update(balanceTable)
      .set({
        withdrawableBalanceLzt: sql`${balanceTable.withdrawableBalanceLzt} - ${amountLzt}`,
      })
      .where(
        and(
          eq(balanceTable.id, owner.id),
          sql`${balanceTable.withdrawableBalanceLzt} >= ${amountLzt}`,
        ),
      )
      .returning({ id: balanceTable.id });

    if (debited.length === 0) {
      res.status(400).json({
        error: "Insufficient зелёный (withdrawable) balance",
      });
      return;
    }

    const [w] = await db
      .insert(withdrawalsTable)
      .values({
        ownerType: owner.type,
        ownerId: owner.id,
        currency: body.data.currency,
        address: body.data.address,
        amount: amountUsdtStr,
        status: "pending",
      })
      .returning();

    if (!w) {
      await db
        .update(balanceTable)
        .set({
          withdrawableBalanceLzt: sql`${balanceTable.withdrawableBalanceLzt} + ${amountLzt}`,
        })
        .where(eq(balanceTable.id, owner.id));
      res.status(500).json({ error: "Failed to create withdrawal" });
      return;
    }

    req.log.info(
      {
        ownerType: owner.type,
        ownerId: owner.id,
        withdrawalId: w.id,
        currency: w.currency,
        amountLzt,
        amountUsdt,
      },
      "Withdrawal requested",
    );

    res.status(201).json({
      id: w.id,
      ownerType: w.ownerType,
      ownerId: w.ownerId,
      currency: w.currency,
      address: w.address,
      amountUsdt,
      amountLzt,
      status: w.status,
      requestedAt: new Date(w.requestedAt).toISOString(),
      completedAt: w.completedAt
        ? new Date(w.completedAt).toISOString()
        : null,
    });
  },
);

export default router;
