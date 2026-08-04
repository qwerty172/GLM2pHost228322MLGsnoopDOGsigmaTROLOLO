import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isWalletCryptoEnabled,
} from "./encryption";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("isWalletCryptoEnabled when key is valid", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
  });

  it("round-trips encrypt/decrypt", () => {
    const payload = encryptSecret("my-private-key");
    expect(decryptSecret(payload)).toBe("my-private-key");
  });
});
