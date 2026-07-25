import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare; returns false if lengths differ. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still run a compare against self so timing doesn't trivially leak length-only
    // differences for empty vs non-empty in the common path — but unequal lengths
    // must fail. Compare bufA to itself then return false.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
