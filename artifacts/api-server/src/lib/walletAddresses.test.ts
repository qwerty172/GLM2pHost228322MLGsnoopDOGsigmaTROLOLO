import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generateAllDepositAddresses,
  generateNanoAddress,
  generateSolanaAddress,
  generateTronUsdtAddress,
} from "./walletAddresses";
import { decryptSecret } from "./encryption";

const TEST_KEY = "0123456789abcdef".repeat(4);

describe("walletAddresses", () => {
  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.WALLET_ENCRYPTION_KEY;
  });

  it("generateSolanaAddress returns valid base58 address", async () => {
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.address.length).toBeGreaterThan(30);
    expect(decryptSecret(addr.encryptedPrivateKey).length).toBeGreaterThan(0);
  });

  it("generateNanoAddress returns nano_ prefixed address", async () => {
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.address.startsWith("nano_")).toBe(true);
  });

  it("generateTronUsdtAddress returns T-prefixed address", async () => {
    const addr = await generateTronUsdtAddress();
    expect(addr.currency).toBe("USDT_TRC20");
    expect(addr.address.startsWith("T")).toBe(true);
  });

  it("generateAllDepositAddresses returns three currencies", async () => {
    const all = await generateAllDepositAddresses();
    expect(all).toHaveLength(3);
    expect(all.map((a) => a.currency).sort()).toEqual(["NANO", "SOL", "USDT_TRC20"]);
  });
});
