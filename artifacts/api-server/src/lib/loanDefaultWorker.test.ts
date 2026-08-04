import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("loanDefaultWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./loanDefaultWorker");
    expect(typeof mod.startLoanDefaultWorker).toBe("function");
    expect(typeof mod.stopLoanDefaultWorker).toBe("function");
    expect(typeof mod.runLoanDefaultCheckOnce).toBe("function");
  });
});
