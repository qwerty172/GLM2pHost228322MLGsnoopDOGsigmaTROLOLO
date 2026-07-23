import { randomBytes } from "node:crypto";

export function generateToken(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Unambiguous uppercase alphanumeric charset (no 0/O, 1/I/L). */
const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short join code for share links (default 8 chars ≈ 41 bits). */
export function generateJoinCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
  }
  return out;
}

/** True when a URL slug looks like a short join code rather than a playerToken. */
export function isJoinCodeSlug(slug: string): boolean {
  return slug.length <= 12 && /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/i.test(slug);
}

