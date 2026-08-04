import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generateNanoAddress, generateSolanaAddress } from "./walletAddresses";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("walletAddresses", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("generates Solana deposit address", async () => {
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.address.length).toBeGreaterThan(10);
    expect(addr.encryptedPrivateKey).toContain(":");
  });

  it("generates Nano deposit address", async () => {
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.address.startsWith("nano_")).toBe(true);
  });
});
