import type { Response } from "express";
import { isWalletCryptoEnabled } from "./encryption";

/** User-facing copy when blockchain nodes / wallet crypto are not configured. */
export const CRYPTO_UNAVAILABLE_ERROR = "crypto_unavailable";
export const CRYPTO_UNAVAILABLE_MESSAGE =
  "Крипто-операции временно недоступны — узлы блокчейна не настроены";

/** Secrets that require WALLET_ENCRYPTION_KEY (stream keys, SSH keys, etc.). */
export const ENCRYPTION_UNAVAILABLE_ERROR = "encryption_unavailable";
export const ENCRYPTION_UNAVAILABLE_MESSAGE =
  "Шифрование секретов временно недоступно — ключ шифрования кошелька не настроен";

export function respondCryptoUnavailable(res: Response): void {
  res.status(503).json({
    error: CRYPTO_UNAVAILABLE_ERROR,
    message: CRYPTO_UNAVAILABLE_MESSAGE,
  });
}

export function respondEncryptionUnavailable(res: Response): void {
  res.status(503).json({
    error: ENCRYPTION_UNAVAILABLE_ERROR,
    message: ENCRYPTION_UNAVAILABLE_MESSAGE,
  });
}

export function isCryptoOperationsEnabled(): boolean {
  return isWalletCryptoEnabled();
}
