import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("quotaExpiryWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./quotaExpiryWorker");
    expect(typeof mod.startQuotaExpiryWorker).toBe("function");
    expect(typeof mod.stopQuotaExpiryWorker).toBe("function");
  });
});
