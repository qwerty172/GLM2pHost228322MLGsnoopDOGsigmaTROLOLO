import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { generateSolanaAddress } from "./walletAddresses";

const KEY = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("walletAddresses", () => {
  const prev = process.env.WALLET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.WALLET_ENCRYPTION_KEY;
    else process.env.WALLET_ENCRYPTION_KEY = prev;
  });

  it("generateSolanaAddress returns encrypted key", async () => {
    const addr = await generateSolanaAddress();
    expect(addr.currency).toBe("SOL");
    expect(addr.address.length).toBeGreaterThan(10);
    expect(addr.encryptedPrivateKey).toContain(":");
  });
});
