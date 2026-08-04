import { describe, expect, it, beforeAll } from "vitest";
import { decryptSecret, encryptSecret, isWalletCryptoEnabled } from "./encryption";

describe("encryption", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("isWalletCryptoEnabled when key is valid", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
  });

  it("round-trips encrypt/decrypt", () => {
    const payload = encryptSecret("hello-wallet-secret");
    expect(payload.split(":")).toHaveLength(3);
    expect(decryptSecret(payload)).toBe("hello-wallet-secret");
  });
});
