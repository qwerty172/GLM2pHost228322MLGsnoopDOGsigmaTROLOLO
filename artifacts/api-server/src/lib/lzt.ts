// Shared helper for the fixed-rate LZT ↔ USDT conversion.
//
// LZT is a virtual platform currency. The exchange rate is hardcoded for v1:
//   1 USDT = 200 LZT
// All LZT amounts are integers (no fractional unit needed at 200:1; the
// smallest meaningful real-world value, 1 LZT, is half a US cent).

export const LZT_PER_USDT = 200;

// Convert a USDT-equivalent number (can be fractional, e.g. 1.234567) into
// integer LZT. We floor on the way in so we never credit more LZT than the
// deposited USDT is actually worth.
export function usdtToLzt(usdt: number): number {
  if (!Number.isFinite(usdt) || usdt <= 0) return 0;
  return Math.floor(usdt * LZT_PER_USDT);
}

// Convert integer LZT back into a USDT-equivalent decimal number.
export function lztToUsdt(lzt: number): number {
  if (!Number.isFinite(lzt) || lzt <= 0) return 0;
  return lzt / LZT_PER_USDT;
}

// Convert a USD/USDT amount into integer LZT, rounding to the nearest LZT.
// Used for things like per-minute billing rates where rounding down on every
// tick would slowly leak value.
export function usdtToLztRound(usdt: number): number {
  if (!Number.isFinite(usdt) || usdt <= 0) return 0;
  return Math.round(usdt * LZT_PER_USDT);
}

export type PaymentSource = "blue" | "green" | "auto";
export type PlayerFundingSource = "green" | "blue" | "credit";

/** Remaining gaming credit line (LZT) after outstanding debt. */
export function availableCreditLzt(
  creditLimitLzt: number,
  creditDebtLzt: number,
): number {
  return Math.max(0, creditLimitLzt - creditDebtLzt);
}

// Single source of truth for which bucket a player's debit should come from.
//
// Rules (must match billingWorker, launchFee, claim precheck, and signaling):
//   "blue"  → only blue, no fallback
//   "green" → only green, no fallback
//   "auto"  → green if green alone covers the amount, otherwise blue if blue
//             alone covers it. Never combine buckets — combining would let a
//             session start that billing can't actually debit on the next
//             tick, which would silently end the session immediately.
export function pickPlayerBucket(
  paymentSource: string,
  amountLzt: number,
  greenLzt: number,
  blueLzt: number,
): "blue" | "green" | null {
  if (paymentSource === "blue") {
    return blueLzt >= amountLzt ? "blue" : null;
  }
  if (paymentSource === "green") {
    return greenLzt >= amountLzt ? "green" : null;
  }
  if (greenLzt >= amountLzt) return "green";
  if (blueLzt >= amountLzt) return "blue";
  return null;
}

// Like pickPlayerBucket, but for paymentSource "auto" also considers the
// player's gaming credit line (creditLimitLzt − creditDebtLzt). Explicit
// green/blue choices never fall back to credit.
export function pickPlayerFundingSource(
  paymentSource: string,
  amountLzt: number,
  greenLzt: number,
  blueLzt: number,
  creditLimitLzt: number,
  creditDebtLzt: number,
): PlayerFundingSource | null {
  const bucket = pickPlayerBucket(
    paymentSource,
    amountLzt,
    greenLzt,
    blueLzt,
  );
  if (bucket) return bucket;
  if (paymentSource === "green" || paymentSource === "blue") return null;
  const creditAvailable = availableCreditLzt(creditLimitLzt, creditDebtLzt);
  return creditAvailable >= amountLzt ? "credit" : null;
}
