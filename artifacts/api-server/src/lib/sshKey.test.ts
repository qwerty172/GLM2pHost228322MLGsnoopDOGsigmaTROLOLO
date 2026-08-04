import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { encryptSshKey, decryptSshKey } from "./sshKey";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("sshKey", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("encrypts and decrypts SSH private keys", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest";
    const enc = encryptSshKey(key);
    expect(decryptSshKey(enc)).toBe(key);
  });
});
