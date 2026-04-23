import { eq, and, sql } from "drizzle-orm";
import {
  db,
  hostsTable,
  playersTable,
  depositAddressesTable,
  depositsTable,
} from "@workspace/db";
import { logger } from "./logger";

const POLL_INTERVAL_MS = Number(
  process.env["WALLET_DEPOSIT_POLL_MS"] ?? 60_000,
);
const COMMISSION_RATE = Number(process.env["WALLET_COMMISSION_RATE"] ?? "0.3");
let interval: NodeJS.Timeout | null = null;

interface DetectedDeposit {
  txHash: string;
  amount: number;
}

async function pollSolana(address: string): Promise<DetectedDeposit[]> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(
      process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com",
      "confirmed",
    );
    const sigs = await conn.getSignaturesForAddress(new PublicKey(address), {
      limit: 10,
    });
    const out: DetectedDeposit[] = [];
    for (const s of sigs) {
      if (!s.signature) continue;
      const tx = await conn.getTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) continue;
      const idx = tx.transaction.message
        .getAccountKeys()
        .staticAccountKeys.findIndex((k) => k.toBase58() === address);
      if (idx < 0) continue;
      const pre = tx.meta.preBalances[idx] ?? 0;
      const post = tx.meta.postBalances[idx] ?? 0;
      const delta = post - pre;
      if (delta > 0) {
        out.push({ txHash: s.signature, amount: delta / 1e9 });
      }
    }
    return out;
  } catch (err) {
    logger.debug({ err }, "Solana deposit poll failed");
    return [];
  }
}

async function pollNano(address: string): Promise<DetectedDeposit[]> {
  try {
    const url = process.env["NANO_RPC_URL"] ?? "https://mynano.ninja/api/node";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "account_history",
        account: address,
        count: "10",
      }),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      history?: Array<{ type: string; hash?: string; amount?: string }>;
    };
    const out: DetectedDeposit[] = [];
    for (const h of data.history ?? []) {
      if (h.type !== "receive" || !h.hash || !h.amount) continue;
      const amount = Number(BigInt(h.amount)) / 1e30;
      if (amount > 0) out.push({ txHash: h.hash, amount });
    }
    return out;
  } catch (err) {
    logger.debug({ err }, "Nano deposit poll failed");
    return [];
  }
}

async function pollTronUsdt(address: string): Promise<DetectedDeposit[]> {
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=10&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      data?: Array<{
        transaction_id?: string;
        to?: string;
        value?: string;
        token_info?: { decimals?: number };
      }>;
    };
    const out: DetectedDeposit[] = [];
    for (const t of data.data ?? []) {
      if (!t.transaction_id || !t.value || t.to !== address) continue;
      const decimals = t.token_info?.decimals ?? 6;
      const amount = Number(t.value) / 10 ** decimals;
      if (amount > 0) out.push({ txHash: t.transaction_id, amount });
    }
    return out;
  } catch (err) {
    logger.debug({ err }, "Tron USDT deposit poll failed");
    return [];
  }
}

async function creditDeposit(
  ownerType: "host" | "player",
  ownerId: string,
  address: string,
  currency: string,
  network: string,
  detected: DetectedDeposit,
): Promise<void> {
  const gross = detected.amount;
  const commission = gross * COMMISSION_RATE;
  const net = gross - commission;
  const grossStr = gross.toFixed(6);
  const commissionStr = commission.toFixed(6);
  const netStr = net.toFixed(6);

  try {
    const inserted = await db
      .insert(depositsTable)
      .values({
        ownerType,
        ownerId,
        currency,
        network,
        address,
        txHash: detected.txHash,
        grossAmount: grossStr,
        commissionAmount: commissionStr,
        netAmount: netStr,
        status: "credited",
        creditedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [depositsTable.network, depositsTable.txHash],
      })
      .returning({ id: depositsTable.id });

    if (inserted.length === 0) return; // duplicate

    const balanceTable = ownerType === "host" ? hostsTable : playersTable;
    await db
      .update(balanceTable)
      .set({
        creditBalance: sql`${balanceTable.creditBalance} + ${netStr}::numeric`,
      })
      .where(eq(balanceTable.id, ownerId));

    logger.info(
      { ownerType, ownerId, currency, txHash: detected.txHash, net },
      "Deposit credited",
    );
  } catch (err) {
    logger.error({ err, txHash: detected.txHash }, "Failed to credit deposit");
  }
}

async function pollOnce(): Promise<void> {
  const addresses = await db.select().from(depositAddressesTable);
  for (const addr of addresses) {
    if (addr.ownerType !== "host" && addr.ownerType !== "player") continue;
    let detected: DetectedDeposit[] = [];
    if (addr.currency === "SOL") detected = await pollSolana(addr.address);
    else if (addr.currency === "NANO") detected = await pollNano(addr.address);
    else if (addr.currency === "USDT_TRC20")
      detected = await pollTronUsdt(addr.address);
    for (const d of detected) {
      await creditDeposit(
        addr.ownerType as "host" | "player",
        addr.ownerId,
        addr.address,
        addr.currency,
        addr.network,
        d,
      );
    }
  }
}

export function startDepositWorker(): void {
  if (interval) return;
  if (process.env["WALLET_DEPOSIT_POLLING"] === "off") {
    logger.info("Deposit worker disabled (WALLET_DEPOSIT_POLLING=off)");
    return;
  }
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Starting deposit worker");
  interval = setInterval(() => {
    void pollOnce().catch((err) => {
      logger.error({ err }, "Deposit poll loop crashed");
    });
  }, POLL_INTERVAL_MS);
  setTimeout(() => void pollOnce().catch(() => {}), 10_000);
}

export function stopDepositWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { pollOnce as runDepositPollOnce };
