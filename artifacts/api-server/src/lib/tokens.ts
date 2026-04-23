import { randomBytes } from "node:crypto";

export function generateToken(byteLength = 24): string {
  return randomBytes(byteLength).toString("base64url");
}
