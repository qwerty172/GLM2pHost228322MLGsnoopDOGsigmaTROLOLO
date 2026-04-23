import { Router, type IRouter } from "express";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import {
  db,
  hostsTable,
  withdrawalsTable,
  depositAddressesTable,
} from "@workspace/db";
import {
  GetWalletParams,
  GetWalletResponse,
  RequestWithdrawalParams,
  RequestWithdrawalBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PLACEHOLDER_DEPOSIT_DEFAULTS = [
  {
    currency: "USDT_TRC20",
    label: "USDT (TRON / TRC-20)",
    network: "TRON",
    minDeposit: "1",
  },
  {
    currency: "NANO",
    label: "Nano",
    network: "Nano",
    minDeposit: "0.01",
  },
  {
    currency: "SOL",
    label: "Solana",
    network: "Solana",
    minDeposit: "0.05",
  },
];

function placeholderAddressFor(currency: string, hostId: string): string {
  // Stable, deterministic placeholder addresses until the wallet worker is built.
  const tail = hostId.replace(/-/g, "").slice(0, 16);
  switch (currency) {
    case "USDT_TRC20":
      return `T${tail.toUpperCase()}placeholder${tail.slice(0, 6)}`.slice(0, 34);
    case "NANO":
      return `nano_3${tail}placeholder${tail.slice(0, 24)}`.slice(0, 65);
    case "SOL":
      return `${tail}So1ana${tail.slice(0, 30)}`.slice(0, 44);
    default:
      return `addr_${tail}`;
  }
}

async function ensureDepositAddresses(
  hostId: string,
): Promise<typeof depositAddressesTable.$inferSelect[]> {
  const existing = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.hostId, hostId));
  if (existing.length >= PLACEHOLDER_DEPOSIT_DEFAULTS.length) {
    return existing;
  }
  const haveCurrencies = new Set(existing.map((e) => e.currency));
  const toCreate = PLACEHOLDER_DEPOSIT_DEFAULTS.filter(
    (d) => !haveCurrencies.has(d.currency),
  );
  if (toCreate.length > 0) {
    await db
      .insert(depositAddressesTable)
      .values(
        toCreate.map((d) => ({
          hostId,
          currency: d.currency,
          label: d.label,
          network: d.network,
          minDeposit: d.minDeposit,
          address: placeholderAddressFor(d.currency, hostId),
        })),
      )
      .onConflictDoNothing({
        target: [depositAddressesTable.hostId, depositAddressesTable.currency],
      });
  }
  return await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.hostId, hostId));
}

router.get("/wallet/:hostToken", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [host] = await db
    .select()
    .from(hostsTable)
    .where(eq(hostsTable.hostToken, params.data.hostToken));

  if (!host) {
    res.status(404).json({ error: "Host not found" });
    return;
  }

  const addresses = await ensureDepositAddresses(host.id);

  const recent = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.hostId, host.id))
    .orderBy(desc(withdrawalsTable.requestedAt))
    .limit(10);

  const pendingTotalRows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}), 0)`,
    })
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.hostId, host.id),
        inArray(withdrawalsTable.status, ["pending", "processing"]),
      ),
    );
  const pendingTotal = Number(pendingTotalRows[0]?.total ?? 0);

  res.json(
    GetWalletResponse.parse({
      creditBalance: Number(host.creditBalance),
      pendingWithdrawals: pendingTotal,
      depositAddresses: addresses.map((a) => ({
        currency: a.currency,
        label: a.label,
        address: a.address,
        network: a.network,
        minDeposit: Number(a.minDeposit),
      })),
      recentWithdrawals: recent.map((w) => ({
        id: w.id,
        hostId: w.hostId,
        currency: w.currency,
        address: w.address,
        amount: Number(w.amount),
        status: w.status,
        requestedAt: new Date(w.requestedAt).toISOString(),
        completedAt: w.completedAt
          ? new Date(w.completedAt).toISOString()
          : null,
      })),
    }),
  );
});

router.post(
  "/wallet/:hostToken/withdraw",
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

    if (body.data.amount <= 0) {
      res.status(400).json({ error: "Amount must be positive" });
      return;
    }

    const [host] = await db
      .select({ id: hostsTable.id })
      .from(hostsTable)
      .where(eq(hostsTable.hostToken, params.data.hostToken));

    if (!host) {
      res.status(404).json({ error: "Host not found" });
      return;
    }

    const amountStr = String(body.data.amount);

    // Atomic reserve: only debit if balance is sufficient. The conditional
    // WHERE clause ensures concurrent withdrawals can't overdraw the account.
    const debited = await db
      .update(hostsTable)
      .set({
        creditBalance: sql`${hostsTable.creditBalance} - ${amountStr}::numeric`,
      })
      .where(
        and(
          eq(hostsTable.id, host.id),
          sql`${hostsTable.creditBalance} >= ${amountStr}::numeric`,
        ),
      )
      .returning({ id: hostsTable.id });

    if (debited.length === 0) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }

    const [w] = await db
      .insert(withdrawalsTable)
      .values({
        hostId: host.id,
        currency: body.data.currency,
        address: body.data.address,
        amount: amountStr,
        status: "pending",
      })
      .returning();

    if (!w) {
      // Refund the reservation since the withdrawal record could not be
      // created — keeps the host's credit balance consistent.
      await db
        .update(hostsTable)
        .set({
          creditBalance: sql`${hostsTable.creditBalance} + ${amountStr}::numeric`,
        })
        .where(eq(hostsTable.id, host.id));
      res.status(500).json({ error: "Failed to create withdrawal" });
      return;
    }

    req.log.info(
      { hostId: host.id, withdrawalId: w.id, currency: w.currency },
      "Withdrawal requested",
    );

    res.status(201).json({
      id: w.id,
      hostId: w.hostId,
      currency: w.currency,
      address: w.address,
      amount: Number(w.amount),
      status: w.status,
      requestedAt: new Date(w.requestedAt).toISOString(),
      completedAt: w.completedAt
        ? new Date(w.completedAt).toISOString()
        : null,
    });
  },
);

export default router;
