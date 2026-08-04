import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("walletOwner", () => {
  it("exports owner resolution helpers", async () => {
    const mod = await import("./walletOwner");
    expect(typeof mod.resolveOwnerByToken).toBe("function");
    expect(typeof mod.ensureDepositAddressesForOwner).toBe("function");
  });
});
