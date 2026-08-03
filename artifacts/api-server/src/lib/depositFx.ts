/** USD conversion for native-currency deposits (SOL, NANO). */

export type NativeDepositCurrency = "SOL" | "NANO";

const ENV_RATE_KEY: Record<NativeDepositCurrency, string> = {
  SOL: "DEPOSIT_SOL_USD_RATE",
  NANO: "DEPOSIT_NANO_USD_RATE",
};

const COINGECKO_ID: Record<NativeDepositCurrency, string> = {
  SOL: "solana",
  NANO: "nano",
};

/** Convert a USDT-equivalent float to integer cents (1¢ = 0.01 USDT). */
export function toUsdtCents(usdtAmount: number): number {
  if (!Number.isFinite(usdtAmount) || usdtAmount <= 0) return 0;
  return Math.floor(usdtAmount * 100);
}

/** Convert native coin units to USDT-equivalent cents using a USD/unit rate. */
export function nativeUnitsToUsdtCents(
  nativeAmount: number,
  usdPerUnit: number,
): number {
  if (!Number.isFinite(nativeAmount) || nativeAmount <= 0) return 0;
  if (!Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return 0;
  return toUsdtCents(nativeAmount * usdPerUnit);
}

export function parseEnvUsdRate(currency: NativeDepositCurrency): number | null {
  const raw = process.env[ENV_RATE_KEY[currency]];
  if (raw === undefined || raw === "") return null;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

const RATE_CACHE_TTL_MS = 5 * 60_000;
let rateCache: Partial<Record<NativeDepositCurrency, number>> = {};
let rateCacheFetchedAt = 0;

async function fetchCoingeckoUsdRates(): Promise<
  Partial<Record<NativeDepositCurrency, number>>
> {
  const resp = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana,nano&vs_currencies=usd",
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!resp.ok) {
    throw new Error(`CoinGecko HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as Record<
    string,
    { usd?: number } | undefined
  >;
  const out: Partial<Record<NativeDepositCurrency, number>> = {};
  const sol = data[COINGECKO_ID.SOL]?.usd;
  const nano = data[COINGECKO_ID.NANO]?.usd;
  if (typeof sol === "number" && sol > 0) out.SOL = sol;
  if (typeof nano === "number" && nano > 0) out.NANO = nano;
  return out;
}

/** Resolve USD price per native unit. Env override wins; otherwise CoinGecko cache. */
export async function resolveUsdPerUnit(
  currency: NativeDepositCurrency,
): Promise<number | null> {
  const envRate = parseEnvUsdRate(currency);
  if (envRate !== null) return envRate;

  const now = Date.now();
  if (
    now - rateCacheFetchedAt < RATE_CACHE_TTL_MS &&
    rateCache[currency] !== undefined
  ) {
    return rateCache[currency] ?? null;
  }

  try {
    const fetched = await fetchCoingeckoUsdRates();
    rateCache = { ...rateCache, ...fetched };
    rateCacheFetchedAt = now;
    return rateCache[currency] ?? null;
  } catch {
    return rateCache[currency] ?? null;
  }
}

/** Test hook: reset in-memory FX cache between tests. */
export function resetDepositFxCacheForTests(): void {
  rateCache = {};
  rateCacheFetchedAt = 0;
}
