import { describe, expect, it } from "vitest";

describe("economy", () => {
  it("module exports core economy functions", async () => {
    const mod = await import("./economy");
    expect(typeof mod.payInternal).toBe("function");
    expect(typeof mod.writeLedger).toBe("function");
    expect(typeof mod.adjustUserBucket).toBe("function");
    expect(typeof mod.creditPayoutToUser).toBe("function");
  });
});
