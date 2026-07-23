import { eq } from "drizzle-orm";
import {
  db,
  depositAddressesTable,
  depositsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { isWalletCryptoEnabled } from "./encryption";
import { applyDepositCents, creditDevKeyDeposit } from "./economy";

const POLL_INTERVAL_MS = Number(
  process.env["WALLET_DEPOSIT_POLL_MS"] ?? 60_000,
);
// Delay between consecutive external RPC calls, to avoid hammering public
// endpoints and tripping their rate limits.
const REQUEST_DELAY_MS = Number(
  process.env["WALLET_DEPOSIT_REQUEST_DELAY_MS"] ?? 350,
);
// When a network returns HTTP 429, pause polling that network for this long.
const RATE_LIMIT_COOLDOWN_MS = Number(
  process.env["WALLET_DEPOSIT_COOLDOWN_MS"] ?? 5 * 60_000,
);
let interval: NodeJS.Timeout | null = null;
// Guard against overlapping runs: if a poll is still in flight when the next
// tick fires, skip it instead of stacking concurrent external calls.
let isPolling = false;
// Per-network cooldown: timestamp (ms) until which a network is paused.
const networkCooldownUntil: Record<string, number> = {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DetectedDeposit {
  txHash: string;
  amount: number;
}

// Pollers return the deposits found plus whether the upstream signalled a rate
// limit, so the caller can back that network off for a while.
interface PollResult {
  deposits: DetectedDeposit[];
  rateLimited: boolean;
}

async function pollSolana(address: string): Promise<PollResult> {
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
    return { deposits: out, rateLimited: false };
  } catch (err) {
    const rateLimited = /429|rate.?limit|too many/i.test(String(err));
    logger.debug({ err }, "Solana deposit poll failed");
    return { deposits: [], rateLimited };
  }
}

async function pollNano(address: string): Promise<PollResult> {
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
    if (resp.status === 429) return { deposits: [], rateLimited: true };
    if (!resp.ok) return { deposits: [], rateLimited: false };
    const data = (await resp.json()) as {
      history?: Array<{ type: string; hash?: string; amount?: string }>;
    };
    const out: DetectedDeposit[] = [];
    for (const h of data.history ?? []) {
      if (h.type !== "receive" || !h.hash || !h.amount) continue;
      const amount = Number(BigInt(h.amount)) / 1e30;
      if (amount > 0) out.push({ txHash: h.hash, amount });
    }
    return { deposits: out, rateLimited: false };
  } catch (err) {
    logger.debug({ err }, "Nano deposit poll failed");
    return { deposits: [], rateLimited: false };
  }
}

async function pollTronUsdt(address: string): Promise<PollResult> {
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=10&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;
    const resp = await fetch(url);
    if (resp.status === 429) return { deposits: [], rateLimited: true };
    if (!resp.ok) return { deposits: [], rateLimited: false };
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
    return { deposits: out, rateLimited: false };
  } catch (err) {
    logger.debug({ err }, "Tron USDT deposit poll failed");
    return { deposits: [], rateLimited: false };
  }
}

// Convert a 6-decimal USDT-equivalent number to integer cents (1¢ = 0.01 USDT).
function toUsdtCents(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * 100);
}

async function creditDeposit(
  ownerType: "host" | "player" | "dev_key",
  ownerId: string,
  address: string,
  currency: string,
  network: string,
  detected: DetectedDeposit,
): Promise<void> {
  const grossCents = toUsdtCents(detected.amount);
  if (grossCents <= 0) return;

  try {
    const credited = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(depositsTable)
        .values({
          ownerType,
          ownerId,
          currency,
          network,
          address,
          txHash: detected.txHash,
          // Deposit row stores marketing-style breakdown (in USDT). The tariff
          // is recomputed inside applyDepositCents — we mirror those numbers
          // here for reporting only.
          grossAmount: detected.amount.toFixed(6),
          commissionAmount: "0",
          netAmount: detected.amount.toFixed(6),
          status: "credited",
          creditedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [depositsTable.network, depositsTable.txHash],
        })
        .returning({ id: depositsTable.id });

      if (inserted.length === 0) return null;

      // Dev keys skip the tariff/premium machinery — see creditDevKeyDeposit.
      if (ownerType === "dev_key") {
        const devResult = await creditDevKeyDeposit(tx, {
          devKeyId: ownerId,
          grossUsdtCents: grossCents,
          refType: "deposit",
          refId: inserted[0]!.id,
        });
        return { feeLzt: 0, grantedFreePremium: false, ...devResult };
      }

      const result = await applyDepositCents(tx, {
        ownerType,
        ownerId,
        grossUsdtCents: grossCents,
        refType: "deposit",
        refId: inserted[0]!.id,
      });
      // Mirror the actual tariff-applied commission back onto the deposit row.
      const feeUsdt = result.feeLzt / 200;
      const netUsdt = detected.amount - feeUsdt;
      await tx
        .update(depositsTable)
        .set({
          commissionAmount: feeUsdt.toFixed(6),
          netAmount: Math.max(0, netUsdt).toFixed(6),
        })
        .where(eq(depositsTable.id, inserted[0]!.id));
      return result;
    });

    if (credited) {
      logger.info(
        {
          ownerType,
          ownerId,
          currency,
          txHash: detected.txHash,
          feeLzt: credited.feeLzt,
          cashLzt: credited.cashLzt,
          balanceLzt: credited.balanceLzt,
          grantedFreePremium: credited.grantedFreePremium,
        },
        "Deposit credited (economy v1)",
      );
    }
  } catch (err) {
    logger.error({ err, txHash: detected.txHash }, "Failed to credit deposit");
  }
}

async function pollOnce(): Promise<void> {
  // Skip if a previous run is still in flight — prevents stacking concurrent
  // external calls when the network is slow.
  if (isPolling) {
    logger.debug("Deposit poll skipped — previous run still in flight");
    return;
  }
  isPolling = true;
  try {
    const addresses = await db.select().from(depositAddressesTable);
    let madeRequest = false;
    for (const addr of addresses) {
      if (
        addr.ownerType !== "host" &&
        addr.ownerType !== "player" &&
        addr.ownerType !== "dev_key"
      )
        continue;

      // Honour per-network cooldown after a 429.
      const cooldown = networkCooldownUntil[addr.currency] ?? 0;
      if (Date.now() < cooldown) continue;

      // Throttle: space out external calls (skip the delay before the first).
      if (madeRequest) await sleep(REQUEST_DELAY_MS);

      let result: PollResult | null = null;
      if (addr.currency === "SOL") result = await pollSolana(addr.address);
      else if (addr.currency === "NANO") result = await pollNano(addr.address);
      else if (addr.currency === "USDT_TRC20")
        result = await pollTronUsdt(addr.address);
      if (!result) continue;
      madeRequest = true;

      if (result.rateLimited) {
        networkCooldownUntil[addr.currency] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        logger.warn(
          { currency: addr.currency, cooldownMs: RATE_LIMIT_COOLDOWN_MS },
          "Deposit RPC rate-limited — backing off network",
        );
        continue;
      }

      for (const d of result.deposits) {
        await creditDeposit(
          addr.ownerType as "host" | "player" | "dev_key",
          addr.ownerId,
          addr.address,
          addr.currency,
          addr.network,
          d,
        );
      }
    }
  } finally {
    isPolling = false;
  }
}

export function startDepositWorker(): void {
  if (interval) return;
  if (process.env["WALLET_DEPOSIT_POLLING"] === "off") {
    logger.info("Deposit worker disabled (WALLET_DEPOSIT_POLLING=off)");
    return;
  }
  if (!isWalletCryptoEnabled()) {
    logger.info(
      "Deposit worker disabled (WALLET_ENCRYPTION_KEY not configured)",
    );
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
