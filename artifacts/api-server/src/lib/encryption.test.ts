import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { decryptSecret, encryptSecret, isWalletCryptoEnabled } from "./encryption";

const KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("encryption", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("round-trips secrets", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
    const enc = encryptSecret("hello");
    expect(decryptSecret(enc)).toBe("hello");
  });
});
