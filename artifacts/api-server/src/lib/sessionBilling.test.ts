import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("sessionBilling", () => {
  it("exports billing helpers", async () => {
    const mod = await import("./sessionBilling");
    expect(typeof mod.countSessionMinutesUsed).toBe("function");
    expect(typeof mod.refundBlockRemainder).toBe("function");
  });
});
