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
    expect(addr.address.length).toBeGreaterThan(10);
    expect(addr.encryptedPrivateKey.includes(":")).toBe(true);
  });
});
