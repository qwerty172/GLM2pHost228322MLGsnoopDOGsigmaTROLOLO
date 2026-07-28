import {
  createBlock,
  convert,
  deriveAddress,
  derivePublicKey,
  Unit,
} from "nanocurrency";
import { TronWeb } from "tronweb";
import { getHotWalletSecret } from "./hotWallets";
import { logger } from "./logger";

const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export class PayoutError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PayoutError";
  }
}

export interface PayoutResult {
  txHash: string;
}

function isRetryableHttp(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableMessage(msg: string): boolean {
  return /429|rate.?limit|timeout|econnreset|enotfound|network|temporar/i.test(
    msg,
  );
}

async function nanoRpc<T>(body: Record<string, unknown>): Promise<T> {
  const url = process.env["NANO_RPC_URL"] ?? "https://mynano.ninja/api/node";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new PayoutError(
      `Nano RPC HTTP ${resp.status}`,
      isRetryableHttp(resp.status),
    );
  }
  const data = (await resp.json()) as T & { error?: string };
  if (typeof data.error === "string" && data.error.length > 0) {
    throw new PayoutError(
      `Nano RPC error: ${data.error}`,
      isRetryableMessage(data.error),
    );
  }
  return data;
}

async function sendSolana(
  toAddress: string,
  amount: number,
  secretBase64: string,
): Promise<PayoutResult> {
  const { Connection, Keypair, PublicKey, SystemProgram, sendAndConfirmTransaction, Transaction } =
    await import("@solana/web3.js");
  const secretKey = Buffer.from(secretBase64, "base64");
  const kp = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(
    process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet-beta.solana.com",
    "confirmed",
  );
  const lamports = Math.floor(amount * 1e9);
  if (lamports <= 0) {
    throw new PayoutError("SOL amount too small", false);
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: kp.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports,
    }),
  );
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [kp], {
      commitment: "confirmed",
    });
    return { txHash: sig };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PayoutError(msg, isRetryableMessage(msg));
  }
}

async function sendNano(
  toAddress: string,
  amount: number,
  seedAndSecret: string,
): Promise<PayoutResult> {
  const [, secretKey] = seedAndSecret.split(":");
  if (!secretKey) {
    throw new PayoutError("Malformed NANO hot wallet secret", false);
  }
  const publicKey = derivePublicKey(secretKey);
  const fromAddress = deriveAddress(publicKey, { useNanoPrefix: true });
  const info = await nanoRpc<{
    frontier?: string;
    balance?: string;
    representative?: string;
  }>({
    action: "account_info",
    account: fromAddress,
    representative: true,
  });
  if (!info.frontier || info.balance === undefined) {
    throw new PayoutError("Nano hot wallet account not opened", false);
  }
  const amountRaw = convert(amount.toString(), {
    from: Unit.Nano,
    to: Unit.raw,
  });
  const newBalance = (BigInt(info.balance) - BigInt(amountRaw)).toString();
  if (BigInt(newBalance) < 0n) {
    throw new PayoutError("Nano hot wallet insufficient balance", false);
  }
  const block = createBlock(secretKey, {
    work: null,
    balance: newBalance,
    representative: info.representative ?? fromAddress,
    previous: info.frontier,
    link: toAddress,
  });
  const workResp = await nanoRpc<{ work?: string }>({
    action: "work_generate",
    hash: block.hash,
  });
  if (!workResp.work) {
    throw new PayoutError("Nano work generation failed", true);
  }
  block.block.work = workResp.work;
  const processed = await nanoRpc<{ hash?: string }>({
    action: "process",
    json_block: "true",
    subtype: "send",
    block: block.block,
  });
  return { txHash: processed.hash ?? block.hash };
}

async function sendTronUsdt(
  toAddress: string,
  amount: number,
  privateKeyHex: string,
): Promise<PayoutResult> {
  const tronWeb = new TronWeb({
    fullHost: process.env["TRON_FULL_HOST"] ?? "https://api.trongrid.io",
    privateKey: privateKeyHex,
  });
  const amountSun = Math.floor(amount * 1e6);
  if (amountSun <= 0) {
    throw new PayoutError("USDT amount too small", false);
  }
  try {
    const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
    const txId = await contract.transfer(toAddress, amountSun).send({
      feeLimit: 100_000_000,
    });
    return { txHash: String(txId) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new PayoutError(msg, isRetryableMessage(msg));
  }
}

export async function sendWithdrawalPayout(args: {
  currency: string;
  toAddress: string;
  amountUsdt: number;
}): Promise<PayoutResult> {
  const secret = getHotWalletSecret(args.currency);
  if (!secret) {
    throw new PayoutError(
      `Hot wallet not configured for ${args.currency}`,
      false,
    );
  }
  if (!Number.isFinite(args.amountUsdt) || args.amountUsdt <= 0) {
    throw new PayoutError("Invalid withdrawal amount", false);
  }

  logger.info(
    {
      currency: args.currency,
      toAddress: args.toAddress,
      amountUsdt: args.amountUsdt,
    },
    "Sending withdrawal payout",
  );

  switch (args.currency) {
    case "SOL":
      return sendSolana(args.toAddress, args.amountUsdt, secret);
    case "NANO":
      return sendNano(args.toAddress, args.amountUsdt, secret);
    case "USDT_TRC20":
      return sendTronUsdt(args.toAddress, args.amountUsdt, secret);
    default:
      throw new PayoutError(`Unsupported withdrawal currency: ${args.currency}`, false);
  }
}
