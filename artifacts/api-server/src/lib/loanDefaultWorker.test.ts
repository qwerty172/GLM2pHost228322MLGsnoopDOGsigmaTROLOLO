import { describe, expect, it } from "vitest";
import { startLoanDefaultWorker } from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  it("exports startLoanDefaultWorker", () => {
    expect(typeof startLoanDefaultWorker).toBe("function");
  });
});
