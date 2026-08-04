import { beforeAll, describe, expect, it } from "vitest";
import { encryptSshKey, decryptSshKey } from "./sshKey";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("sshKey", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  it("encrypts and decrypts SSH private keys", () => {
    const key = "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";
    const enc = encryptSshKey(key);
    expect(decryptSshKey(enc)).toBe(key);
  });
});
