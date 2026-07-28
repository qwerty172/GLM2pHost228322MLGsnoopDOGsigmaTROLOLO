import { decryptSecret, isWalletCryptoEnabled } from "./encryption";

/** Env var holding an encryptSecret()-wrapped hot-wallet key per payout currency. */
const ENV_BY_CURRENCY: Record<string, string> = {
  SOL: "WALLET_HOT_SOL_ENCRYPTED",
  NANO: "WALLET_HOT_NANO_ENCRYPTED",
  USDT_TRC20: "WALLET_HOT_TRON_ENCRYPTED",
};

export function hotWalletEnvVar(currency: string): string | undefined {
  return ENV_BY_CURRENCY[currency];
}

export function isHotWalletConfigured(currency: string): boolean {
  if (!isWalletCryptoEnabled()) return false;
  const envKey = ENV_BY_CURRENCY[currency];
  if (!envKey) return false;
  const val = process.env[envKey];
  return typeof val === "string" && val.trim().length > 0;
}

export function getHotWalletSecret(currency: string): string | null {
  const envKey = ENV_BY_CURRENCY[currency];
  if (!envKey) return null;
  const enc = process.env[envKey]?.trim();
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}
