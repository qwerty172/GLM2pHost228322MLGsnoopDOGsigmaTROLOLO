import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { encryptSshKey, decryptSshKey } from "./sshKey";

const TEST_KEY = "0123456789abcdef".repeat(4);

describe("sshKey", () => {
  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.WALLET_ENCRYPTION_KEY;
  });

  it("round-trips SSH private key via encryption wrapper", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";
    const encrypted = encryptSshKey(key);
    expect(encrypted).not.toContain("BEGIN OPENSSH");
    expect(decryptSshKey(encrypted)).toBe(key);
  });
});
