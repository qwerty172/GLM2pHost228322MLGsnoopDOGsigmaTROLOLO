import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("depositWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./depositWorker");
    expect(typeof mod.startDepositWorker).toBe("function");
    expect(typeof mod.stopDepositWorker).toBe("function");
    expect(typeof mod.runDepositPollOnce).toBe("function");
  });
});
