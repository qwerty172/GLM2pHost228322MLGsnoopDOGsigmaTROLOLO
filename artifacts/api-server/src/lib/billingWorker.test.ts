import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("billingWorker", () => {
  it("exports lifecycle and refund helpers", async () => {
    const mod = await import("./billingWorker");
    expect(typeof mod.startBillingWorker).toBe("function");
    expect(typeof mod.stopBillingWorker).toBe("function");
    expect(typeof mod.refundBlockRemainder).toBe("function");
    expect(typeof mod.countSessionMinutesUsed).toBe("function");
  });
});
