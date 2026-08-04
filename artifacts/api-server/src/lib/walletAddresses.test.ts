import { describe, expect, it, beforeAll } from "vitest";
import { generateNanoAddress, generateSolanaAddress, generateTronUsdtAddress } from "./walletAddresses";

describe("walletAddresses", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("generateSolanaAddress returns valid shape", async () => {
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.address.length).toBeGreaterThan(20);
    expect(addr.encryptedPrivateKey).toContain(":");
  });

  it("generateNanoAddress returns nano_ prefix", async () => {
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.address.startsWith("nano_")).toBe(true);
  });

  it("generateTronUsdtAddress returns TRC20 address", async () => {
    const addr = await generateTronUsdtAddress();
    expect(addr.currency).toBe("USDT_TRC20");
    expect(addr.address.startsWith("T")).toBe(true);
  });
});
