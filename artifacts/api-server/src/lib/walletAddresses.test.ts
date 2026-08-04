import { beforeAll, describe, expect, it } from "vitest";
import { generateNanoAddress } from "./walletAddresses";

const KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("walletAddresses", () => {
  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY = KEY;
  });

  it("generateNanoAddress returns NANO address", async () => {
    const addr = await generateNanoAddress();
    expect(addr.currency).toBe("NANO");
    expect(addr.address).toMatch(/^nano_/);
    expect(addr.encryptedPrivateKey).toContain(":");
  });
});
