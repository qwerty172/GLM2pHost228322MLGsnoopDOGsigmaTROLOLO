import { describe, expect, it, beforeAll } from "vitest";
import { decryptSshKey, encryptSshKey } from "./sshKey";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("sshKey", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  it("encrypts and decrypts SSH private keys", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----";
    const encrypted = encryptSshKey(key);
    expect(decryptSshKey(encrypted)).toBe(key);
  });
});
