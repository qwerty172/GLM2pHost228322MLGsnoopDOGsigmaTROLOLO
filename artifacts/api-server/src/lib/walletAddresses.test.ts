import { describe, expect, it, beforeAll } from "vitest";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("walletAddresses", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = TEST_KEY;
  });

  it("generates Solana deposit address", async () => {
    const { generateSolanaAddress } = await import("./walletAddresses");
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.network).toBe("Solana");
    expect(addr.address.length).toBeGreaterThan(10);
    expect(addr.encryptedPrivateKey.includes(":")).toBe(true);
    expect(addr.minDeposit).toBe("0.05");
  });

  it("generates Nano deposit address", async () => {
    const { generateNanoAddress } = await import("./walletAddresses");
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.network).toBe("Nano");
    expect(addr.label).toBe("Nano (XNO)");
    expect(addr.address.startsWith("nano_")).toBe(true);
    expect(addr.encryptedPrivateKey.includes(":")).toBe(true);
    expect(addr.minDeposit).toBe("0.01");
  });

  it("generates TRON USDT deposit address", async () => {
    const { generateTronUsdtAddress } = await import("./walletAddresses");
    const addr = await generateTronUsdtAddress();
    expect(addr.currency).toBe("USDT_TRC20");
    expect(addr.network).toBe("TRON");
    expect(addr.label).toBe("USDT (TRON / TRC-20)");
    expect(addr.address.startsWith("T")).toBe(true);
    expect(addr.address.length).toBeGreaterThan(10);
    expect(addr.encryptedPrivateKey.includes(":")).toBe(true);
    expect(addr.minDeposit).toBe("1");
  });

  it("generates all deposit addresses", async () => {
    const { generateAllDepositAddresses } = await import("./walletAddresses");
    const addrs = await generateAllDepositAddresses();
    expect(addrs).toHaveLength(3);
    const currencies = addrs.map((a) => a.currency).sort();
    expect(currencies).toEqual(["NANO", "SOL", "USDT_TRC20"]);
    for (const addr of addrs) {
      expect(addr.address.length).toBeGreaterThan(10);
      expect(addr.encryptedPrivateKey.includes(":")).toBe(true);
    }
  });
});
