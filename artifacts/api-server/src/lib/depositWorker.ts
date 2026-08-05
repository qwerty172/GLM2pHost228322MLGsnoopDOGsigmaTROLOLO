import { eq } from "drizzle-orm";
import type { VersionedTransactionResponse } from "@solana/web3.js";
import {
  db,
  depositAddressesTable,
  depositsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { isWalletCryptoEnabled } from "./encryption";
import { applyDepositCents, creditDevKeyDeposit } from "./economy";
import {
  nativeUnitsToUsdtCents,
  resolveUsdPerUnit,
  toUsdtCents,
  type NativeDepositCurrency,
} from "./depositFx";

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
/** Signatures / history rows fetched per RPC page. */
const POLL_PAGE_SIZE = Number(process.env["WALLET_DEPOSIT_PAGE_SIZE"] ?? 100);
/** Max pages per address per poll — bounds RPC load while covering backlog. */
const POLL_MAX_PAGES = Number(process.env["WALLET_DEPOSIT_MAX_PAGES"] ?? 10);

let interval: NodeJS.Timeout | null = null;
// Guard against overlapping runs: if a poll is still in flight when the next
// tick fires, skip it instead of stacking concurrent external calls.
let isPolling = false;
// Per-address cooldown: timestamp (ms) until which a specific deposit address
// is paused after a 429. Keyed by `${network}:${address}` so one SOL wallet's
// rate-limit does not block every other SOL address.
const addressCooldownUntil: Record<string, number> = {};

function cooldownKey(network: string, address: string): string {
  return `${network}:${address}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DetectedDeposit {
  txHash: string;
  /** Native units for SOL/NANO; USDT for TRC-20. */
  amount: number;
}

// Pollers return the deposits found plus whether the upstream signalled a rate
// limit, so the caller can back that network off for a while.
interface PollResult {
  deposits: DetectedDeposit[];
  rateLimited: boolean;
}

/** Resolve deposit-address index for v0 transactions with address lookup tables. */
export function solanaDepositAccountIndex(
  tx: VersionedTransactionResponse,
  address: string,
): number {
  const accountKeys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses,
  });
  for (let i = 0; i < accountKeys.length; i++) {
    const key = accountKeys.get(i);
    if (key?.toBase58() === address) return i;
  }
  return -1;
}

async function pollSolana(address: string): Promise<PollResult> {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(
      process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com",
      "confirmed",
    );
    const pubkey = new PublicKey(address);
    const out: DetectedDeposit[] = [];
    let before: string | undefined;
    for (let page = 0; page < POLL_MAX_PAGES; page++) {
      const sigs = await conn.getSignaturesForAddress(pubkey, {
        limit: POLL_PAGE_SIZE,
        before,
      });
      if (sigs.length === 0) break;
      for (const s of sigs) {
        if (!s.signature) continue;
        const tx = await conn.getTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta) continue;
        const idx = solanaDepositAccountIndex(tx, address);
        if (idx < 0) continue;
        const pre = tx.meta.preBalances[idx] ?? 0;
        const post = tx.meta.postBalances[idx] ?? 0;
        const delta = post - pre;
        if (delta > 0) {
          out.push({ txHash: s.signature, amount: delta / 1e9 });
        }
      }
      before = sigs[sigs.length - 1]?.signature;
      if (!before || sigs.length < POLL_PAGE_SIZE) break;
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
    const out: DetectedDeposit[] = [];
    let head: string | undefined;
    for (let page = 0; page < POLL_MAX_PAGES; page++) {
      const body: Record<string, string> = {
        action: "account_history",
        account: address,
        count: String(POLL_PAGE_SIZE),
      };
      if (head) body.head = head;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.status === 429) return { deposits: [], rateLimited: true };
      if (!resp.ok) return { deposits: [], rateLimited: false };
      const data = (await resp.json()) as {
        history?: Array<{ type: string; hash?: string; amount?: string }>;
      };
      const history = data.history ?? [];
      if (history.length === 0) break;
      for (const h of history) {
        if (h.type !== "receive" || !h.hash || !h.amount) continue;
        const amount = Number(BigInt(h.amount)) / 1e30;
        if (amount > 0) out.push({ txHash: h.hash, amount });
      }
      const lastHash = history[history.length - 1]?.hash;
      if (!lastHash || history.length < POLL_PAGE_SIZE) break;
      head = lastHash;
    }
    return { deposits: out, rateLimited: false };
  } catch (err) {
    logger.debug({ err }, "Nano deposit poll failed");
    return { deposits: [], rateLimited: false };
  }
}

async function pollTronUsdt(address: string): Promise<PollResult> {
  try {
    const out: DetectedDeposit[] = [];
    let fingerprint: string | undefined;
    for (let page = 0; page < POLL_MAX_PAGES; page++) {
      const params = new URLSearchParams({
        limit: String(POLL_PAGE_SIZE),
        contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      });
      if (fingerprint) params.set("fingerprint", fingerprint);
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?${params}`;
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
        meta?: { fingerprint?: string };
      };
      const rows = data.data ?? [];
      for (const t of rows) {
        if (!t.transaction_id || !t.value || t.to !== address) continue;
        const decimals = t.token_info?.decimals ?? 6;
        const amount = Number(t.value) / 10 ** decimals;
        if (amount > 0) out.push({ txHash: t.transaction_id, amount });
      }
      fingerprint = data.meta?.fingerprint;
      if (!fingerprint || rows.length < POLL_PAGE_SIZE) break;
    }
    return { deposits: out, rateLimited: false };
  } catch (err) {
    logger.debug({ err }, "Tron USDT deposit poll failed");
    return { deposits: [], rateLimited: false };
  }
}

async function creditDeposit(
  ownerType: "host" | "player" | "dev_key",
  ownerId: string,
  address: string,
  currency: string,
  network: string,
  detected: DetectedDeposit,
  grossUsdtCents: number,
): Promise<void> {
  if (grossUsdtCents <= 0) return;
  const grossUsdt = grossUsdtCents / 100;

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
          grossAmount: grossUsdt.toFixed(6),
          commissionAmount: "0",
          netAmount: grossUsdt.toFixed(6),
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
          grossUsdtCents: grossUsdtCents,
          refType: "deposit",
          refId: inserted[0]!.id,
        });
        return { feeLzt: 0, grantedFreePremium: false, ...devResult };
      }

      const result = await applyDepositCents(tx, {
        ownerType,
        ownerId,
        grossUsdtCents: grossUsdtCents,
        refType: "deposit",
        refId: inserted[0]!.id,
      });
      // Mirror the actual tariff-applied commission back onto the deposit row.
      const feeUsdt = result.feeLzt / 200;
      const netUsdt = grossUsdt - feeUsdt;
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
          grossUsdtCents,
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

async function resolveGrossUsdtCents(
  currency: string,
  detected: DetectedDeposit,
): Promise<number | null> {
  if (currency === "SOL" || currency === "NANO") {
    const usdPerUnit = await resolveUsdPerUnit(currency as NativeDepositCurrency);
    if (!usdPerUnit) {
      logger.error(
        { currency, txHash: detected.txHash, nativeAmount: detected.amount },
        "Deposit skipped — no USD rate for native currency (set DEPOSIT_*_USD_RATE or ensure CoinGecko reachable)",
      );
      return null;
    }
    const cents = nativeUnitsToUsdtCents(detected.amount, usdPerUnit);
    if (cents <= 0) {
      logger.warn(
        { currency, txHash: detected.txHash, nativeAmount: detected.amount, usdPerUnit },
        "Deposit skipped — native amount below 1 cent after FX",
      );
      return null;
    }
    return cents;
  }
  return toUsdtCents(detected.amount);
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

      // Honour per-address cooldown after a 429 (not whole-currency).
      const key = cooldownKey(addr.network, addr.address);
      const cooldown = addressCooldownUntil[key] ?? 0;
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
        addressCooldownUntil[key] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        logger.warn(
          {
            currency: addr.currency,
            network: addr.network,
            address: addr.address,
            cooldownMs: RATE_LIMIT_COOLDOWN_MS,
          },
          "Deposit RPC rate-limited — backing off address",
        );
        continue;
      }

      for (const d of result.deposits) {
        const grossUsdtCents = await resolveGrossUsdtCents(addr.currency, d);
        if (grossUsdtCents === null) continue;
        await creditDeposit(
          addr.ownerType as "host" | "player" | "dev_key",
          addr.ownerId,
          addr.address,
          addr.currency,
          addr.network,
          d,
          grossUsdtCents,
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
  setTimeout(
    () =>
      void pollOnce().catch((err) => {
        logger.error({ err }, "Initial deposit poll failed");
      }),
    10_000,
  );
}

export function stopDepositWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export { pollOnce as runDepositPollOnce };
