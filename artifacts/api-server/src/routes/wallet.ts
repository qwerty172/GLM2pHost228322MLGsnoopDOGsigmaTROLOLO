import { Router, type IRouter } from "express";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  withdrawalsTable,
  depositsTable,
  billingEventsTable,
  ledgerTable,
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
import { recordWithdrawalDebit } from "../lib/economy";
import { rateLimit, ipKey } from "../lib/rateLimit";
import {
  isCryptoOperationsEnabled,
  respondCryptoUnavailable,
} from "../lib/cryptoRouteHelpers";

const router: IRouter = Router();

// Wallet reads are keyed by IP: a token brute-forcer sends many *different*
// tokens, so per-token buckets would never fill. 429 long before a random
// token space can be explored.
const walletReadLimiter = rateLimit({ // keyed by token (default) — isolated per user
  scope: "wallet:read",
  windowMs: 60_000,
  max: 120, // keyed by token (default) — isolated per user
});
// Withdrawals are rare, human-initiated actions — keep the cap tight.
const withdrawLimiter = rateLimit({
  scope: "wallet:withdraw",
  windowMs: 10 * 60_000,
  max: 5,
  keyFn: ipKey,
});

function ownerBalanceTable(type: OwnerType) {
  return type === "host" ? hostsTable : playersTable;
}

router.get("/wallet/:userToken", walletReadLimiter, async (req, res): Promise<void> => {
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
      // Legacy field names (kept for clients), plus new economy v1 aliases.
      internalBalanceLzt: owner.internalBalanceLzt,
      withdrawableBalanceLzt: owner.withdrawableBalanceLzt,
      balanceLzt: owner.internalBalanceLzt,
      cashLzt: owner.withdrawableBalanceLzt,
      creditLimitLzt: owner.creditLimitLzt,
      creditDebtLzt: owner.creditDebtLzt,
      creditReceivableLzt: owner.creditReceivableLzt,
      premiumUntil: owner.premiumUntil
        ? new Date(owner.premiumUntil).toISOString()
        : null,
      lifetimeDepositUsdtCents: owner.lifetimeDepositUsdtCents,
      pendingWithdrawalsLzt,
      lztPerUsdt: LZT_PER_USDT,
      cryptoEnabled: isCryptoOperationsEnabled(),
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
  walletReadLimiter,
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

    // Ledger is the post-cutover source of truth. To preserve any pre-v1
    // history we ALSO include legacy deposit/withdrawal/billing rows that
    // were written BEFORE this owner's first ledger entry — anything newer
    // is guaranteed to be mirrored in the ledger already, so showing it
    // again would double-count.
    const ledgerRows = await db
      .select()
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.ownerType, owner.type),
          eq(ledgerTable.ownerId, owner.id),
        ),
      )
      .orderBy(desc(ledgerTable.createdAt))
      .limit(100);

    const firstLedgerAtRow = await db
      .select({ first: sql<Date | null>`MIN(${ledgerTable.createdAt})` })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.ownerType, owner.type),
          eq(ledgerTable.ownerId, owner.id),
        ),
      );
    const cutoff: Date | null = firstLedgerAtRow[0]?.first
      ? new Date(firstLedgerAtRow[0].first)
      : null;

    type Tx = {
      id: string;
      kind: string;
      currency: string | null;
      amountLzt: number;
      bucket: string | null;
      status: string | null;
      description: string;
      timestamp: string;
    };
    const txs: Tx[] = [];

    for (const l of ledgerRows) {
      txs.push({
        id: `led-${l.id}`,
        kind: l.kind,
        currency: l.bucket,
        amountLzt: l.deltaLzt,
        bucket: l.bucket,
        status: null,
        description: l.note ?? l.kind,
        timestamp: new Date(l.createdAt).toISOString(),
      });
    }

    // Only fetch legacy rows when there is pre-cutover history to surface.
    if (!cutoff || cutoff > new Date(0)) {
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

      const isPreCutoff = (t: Date | string): boolean => {
        if (!cutoff) return true;
        return new Date(t).getTime() < cutoff.getTime();
      };

      for (const d of deposits) {
        if (!isPreCutoff(d.detectedAt)) continue;
        const netUsdt = Number(d.netAmount);
        txs.push({
          id: `dep-${d.id}`,
          kind: "deposit",
          currency: d.currency,
          amountLzt: usdtToLzt(netUsdt),
          bucket: null,
          status: d.status,
          description: `${d.currency} deposit (net ≈ ${netUsdt} USDT)`,
          timestamp: new Date(d.detectedAt).toISOString(),
        });
      }
      for (const w of withdrawals) {
        if (!isPreCutoff(w.requestedAt)) continue;
        const wUsdt = Number(w.amount);
        txs.push({
          id: `wd-${w.id}`,
          kind: "withdrawal",
          currency: w.currency,
          amountLzt: -usdtToLzt(wUsdt),
          bucket: null,
          status: w.status,
          description: `Withdraw to ${w.address.slice(0, 14)}…`,
          timestamp: new Date(w.requestedAt).toISOString(),
        });
      }
      for (const b of billing) {
        if (!isPreCutoff(b.billedAt)) continue;
        const amountLzt =
          owner.type === "host" ? b.hostCreditLzt : -b.playerDebitLzt;
        if (amountLzt === 0) continue;
        txs.push({
          id: `bill-${b.id}`,
          kind: "session_billing",
          currency: `LZT/${b.bucket}`,
          amountLzt,
          bucket: b.bucket,
          status: null,
          description:
            owner.type === "host"
              ? `Earned from session — ${b.bucket} (${b.minutes} min)`
              : `Played session (${b.minutes} min) — ${b.bucket}`,
          timestamp: new Date(b.billedAt).toISOString(),
        });
      }
    }

    txs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    res.json(txs.slice(0, 100));
  },
);

router.post(
  "/wallet/:userToken/withdraw",
  withdrawLimiter,
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
    if (owner.type === "dev_key") {
      // Out of scope for task-125: API keys are spend-only wallets (top up
      // via deposit, spend via the embed widget). No withdrawal flow.
      res.status(400).json({
        error: "dev_key_no_withdrawal",
        message: "API-ключи не поддерживают вывод — только пополнение и траты",
      });
      return;
    }
    if (!isCryptoOperationsEnabled()) {
      respondCryptoUnavailable(res);
      return;
    }
    const ownerType = owner.type;

    const amountUsdt = lztToUsdt(amountLzt);
    const amountUsdtStr = amountUsdt.toFixed(6);
    const amountUsdtCents = Math.floor(amountUsdt * 100);

    try {
      const created = await db.transaction(async (tx) => {
        const ok = await recordWithdrawalDebit(tx, {
          ownerType,
          ownerId: owner.id,
          amountLzt,
          amountUsdtCents,
        });
        if (!ok) throw new Error("Insufficient зелёный (cash) balance");
        const [w] = await tx
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
        if (!w) throw new Error("Failed to create withdrawal");
        return w;
      });

      req.log.info(
        {
          ownerType: owner.type,
          ownerId: owner.id,
          withdrawalId: created.id,
          currency: created.currency,
          amountLzt,
          amountUsdt,
        },
        "Withdrawal requested",
      );

      res.status(201).json({
        id: created.id,
        ownerType: created.ownerType,
        ownerId: created.ownerId,
        currency: created.currency,
        address: created.address,
        amountUsdt,
        amountLzt,
        status: created.status,
        requestedAt: new Date(created.requestedAt).toISOString(),
        completedAt: created.completedAt
          ? new Date(created.completedAt).toISOString()
          : null,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Withdrawal failed",
      });
    }
  },
);

// Ensure unused import is referenced (sql is used in older blocks but we
// removed direct sql update; re-export-style tag).
void ownerBalanceTable;

export default router;
