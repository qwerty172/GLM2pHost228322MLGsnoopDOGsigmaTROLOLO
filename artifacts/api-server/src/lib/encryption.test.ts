import { describe, expect, it, beforeAll } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isWalletCryptoEnabled,
} from "./encryption";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  it("detects configured wallet crypto", () => {
    expect(isWalletCryptoEnabled()).toBe(true);
  });

  it("round-trips encrypted secrets", () => {
    const payload = encryptSecret("super-secret");
    expect(payload.split(":")).toHaveLength(3);
    expect(decryptSecret(payload)).toBe("super-secret");
  });
});
