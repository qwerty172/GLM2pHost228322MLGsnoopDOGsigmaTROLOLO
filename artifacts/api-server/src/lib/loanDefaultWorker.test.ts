import { describe, expect, it } from "vitest";
import { startLoanDefaultWorker, stopLoanDefaultWorker } from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  it("start/stop without throwing", () => {
    startLoanDefaultWorker();
    stopLoanDefaultWorker();
    expect(true).toBe(true);
  });
});
