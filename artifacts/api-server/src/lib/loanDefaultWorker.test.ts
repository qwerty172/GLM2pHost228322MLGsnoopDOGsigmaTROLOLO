import { describe, expect, it } from "vitest";
import { startLoanDefaultWorker, stopLoanDefaultWorker, runLoanDefaultCheckOnce } from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startLoanDefaultWorker).toBe("function");
    expect(typeof runLoanDefaultCheckOnce).toBe("function");
  });
});
