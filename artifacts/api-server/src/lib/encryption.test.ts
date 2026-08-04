import { beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret, isWalletCryptoEnabled } from "./encryption";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  it("round-trips secrets", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
    const payload = encryptSecret("hello-wallet");
    expect(decryptSecret(payload)).toBe("hello-wallet");
  });
});
