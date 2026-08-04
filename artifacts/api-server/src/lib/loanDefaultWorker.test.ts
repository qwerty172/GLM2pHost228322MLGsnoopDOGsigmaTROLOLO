import { describe, expect, it } from "vitest";
import { runLoanDefaultCheckOnce, startLoanDefaultWorker, stopLoanDefaultWorker } from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startLoanDefaultWorker).toBe("function");
    expect(typeof stopLoanDefaultWorker).toBe("function");
    expect(typeof runLoanDefaultCheckOnce).toBe("function");
  });
});
