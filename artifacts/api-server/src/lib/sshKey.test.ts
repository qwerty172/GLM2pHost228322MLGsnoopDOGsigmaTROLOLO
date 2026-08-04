import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { decryptSshKey, encryptSshKey } from "./sshKey";

const KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("sshKey", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("encrypts and decrypts SSH keys", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END";
    const enc = encryptSshKey(key);
    expect(decryptSshKey(enc)).toBe(key);
  });
});
