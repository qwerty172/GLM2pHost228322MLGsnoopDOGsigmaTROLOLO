import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("interestWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./interestWorker");
    expect(typeof mod.startInterestWorker).toBe("function");
    expect(typeof mod.stopInterestWorker).toBe("function");
    expect(typeof mod.runInterestPayoutOnce).toBe("function");
  });
});
