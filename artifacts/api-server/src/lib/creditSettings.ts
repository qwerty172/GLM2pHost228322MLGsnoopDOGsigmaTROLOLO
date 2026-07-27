/** Platform gaming credit line defaults (LZT). */
export const GUEST_CREDIT_LIMIT_LZT = 500;
export const DEFAULT_CREDIT_LIMIT_LZT = 3000;

export function defaultCreditLimitLzt(isGuest: boolean): number {
  return isGuest ? GUEST_CREDIT_LIMIT_LZT : DEFAULT_CREDIT_LIMIT_LZT;
}

export function creditEnabledFromLimit(creditLimitLzt: number): boolean {
  return creditLimitLzt > 0;
}

/** Map profile toggle to stored `credit_limit_lzt`. */
export function creditLimitFromEnabled(
  creditEnabled: boolean,
  isGuest: boolean,
): number {
  return creditEnabled ? defaultCreditLimitLzt(isGuest) : 0;
}
