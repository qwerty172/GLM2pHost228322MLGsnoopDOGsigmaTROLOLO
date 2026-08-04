import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const TEST_KEY = "0123456789abcdef".repeat(4);

describe("encryption", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.WALLET_ENCRYPTION_KEY;
    vi.resetModules();
  });

  it("isWalletCryptoEnabled when key is valid", async () => {
    const { isWalletCryptoEnabled } = await import("./encryption");
    expect(isWalletCryptoEnabled()).toBe(true);
  });

  it("round-trips encrypt/decrypt", async () => {
    const { encryptSecret, decryptSecret } = await import("./encryption");
    const payload = encryptSecret("my-wallet-secret");
    expect(decryptSecret(payload)).toBe("my-wallet-secret");
  });

  it("rejects malformed payload", async () => {
    const { decryptSecret } = await import("./encryption");
    expect(() => decryptSecret("not-valid")).toThrow("Malformed encrypted payload");
  });
});

describe("isWalletCryptoEnabled without key", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.WALLET_ENCRYPTION_KEY;
  });

  it("returns false when WALLET_ENCRYPTION_KEY unset", async () => {
    const { isWalletCryptoEnabled } = await import("./encryption");
    expect(isWalletCryptoEnabled()).toBe(false);
  });
});
