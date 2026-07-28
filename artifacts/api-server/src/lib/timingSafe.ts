import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets (admin secret, shared tokens).
 * Returns false when either side is empty or lengths differ.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
