export const LZT_PER_USDT = 200;

export const TRANSAK_HOST = "https://global.transak.com";

export const WITHDRAW_CURRENCIES = [
  { id: "USDT_TRC20", label: "USDT", net: "TRC20" },
  { id: "SOL", label: "SOL", net: "Solana" },
  { id: "NANO", label: "XNO", net: "Nano" },
] as const;

export function formatLzt(lzt: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.trunc(lzt));
}

export function lztToUsdt(lzt: number): number {
  return lzt / LZT_PER_USDT;
}

export function isTransakEnabled(apiKey?: string | null): boolean {
  return Boolean(apiKey?.trim());
}

export function buildTransakUrl(opts: {
  apiKey: string;
  walletAddress: string;
  defaultFiatAmount?: number;
  email?: string;
}): string {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    throw new Error("VITE_TRANSAK_API_KEY is not configured");
  }
  const params = new URLSearchParams({
    apiKey,
    walletAddress: opts.walletAddress,
    cryptoCurrencyCode: "USDT",
    network: "tron",
    fiatCurrency: "USD",
    defaultFiatAmount: String(opts.defaultFiatAmount ?? 50),
    themeColor: "0ea5e9",
    hideMenu: "true",
    disableWalletAddressForm: "true",
    productsAvailed: "BUY",
  });
  if (opts.email) params.set("email", opts.email);
  return `${TRANSAK_HOST}/?${params.toString()}`;
}

export function resolveWalletToken(
  playerWalletToken?: string | null,
  hostToken?: string | null,
): string {
  return playerWalletToken ?? hostToken ?? "";
}

export function parseWithdrawAmountLzt(raw: string): number {
  return parseInt(raw || "0", 10) || 0;
}

export function isWithdrawOverGreen(parsedAmount: number, greenLzt: number): boolean {
  return parsedAmount > greenLzt;
}

export type WithdrawValidationResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "over_balance" };

export function validateWithdrawAmountLzt(
  amountLzt: number,
  greenLzt: number,
): WithdrawValidationResult {
  if (!Number.isFinite(amountLzt) || amountLzt <= 0) {
    return { ok: false, error: "invalid" };
  }
  if (amountLzt > greenLzt) {
    return { ok: false, error: "over_balance" };
  }
  return { ok: true };
}

export function canSubmitWithdraw(opts: {
  withdrawAddress: string;
  withdrawAmountLzt: string;
  greenLzt: number;
  isPending: boolean;
}): boolean {
  if (opts.isPending || !opts.withdrawAddress || !opts.withdrawAmountLzt) {
    return false;
  }
  const parsed = parseWithdrawAmountLzt(opts.withdrawAmountLzt);
  if (parsed <= 0 || isWithdrawOverGreen(parsed, opts.greenLzt)) {
    return false;
  }
  return true;
}

export function formatUsdtAddressPreview(address: string): string {
  if (address.length <= 14) return address;
  return `${address.substring(0, 8)}…${address.substring(address.length - 6)}`;
}

export function findUsdtTrc20Address(
  depositAddresses: Array<{ currency: string; address: string }> | undefined,
): string | undefined {
  return depositAddresses?.find((a) => a.currency === "USDT_TRC20")?.address;
}
