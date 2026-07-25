import crypto from "node:crypto";

/** Generate a cryptographically random 6-digit numeric OTP. */
export function generateOtp(): string {
  // Use rejection sampling so every digit position is uniform 0-9.
  while (true) {
    const n = crypto.randomInt(0, 1_000_000);
    return n.toString().padStart(6, "0");
  }
}

/** Constant-time OTP comparison to prevent timing attacks. */
export function verifyOtp(submitted: string, expected: string): boolean {
  if (submitted.length !== expected.length) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  return crypto.timingSafeEqual(a, b);
}
