import { describe, expect, it, beforeAll } from "vitest";
import { decryptSshKey, encryptSshKey } from "./sshKey";

describe("sshKey", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("round-trips SSH private key encryption", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";
    const enc = encryptSshKey(key);
    expect(decryptSshKey(enc)).toBe(key);
  });
});
