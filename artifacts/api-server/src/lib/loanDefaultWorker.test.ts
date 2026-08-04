import { describe, expect, it, afterEach } from "vitest";
import {
  startLoanDefaultWorker,
  stopLoanDefaultWorker,
  runLoanDefaultCheckOnce,
} from "./loanDefaultWorker";

describe("loanDefaultWorker", () => {
  afterEach(() => {
    stopLoanDefaultWorker();
  });

  it("exports worker lifecycle and runLoanDefaultCheckOnce", () => {
    expect(typeof startLoanDefaultWorker).toBe("function");
    expect(typeof stopLoanDefaultWorker).toBe("function");
    expect(typeof runLoanDefaultCheckOnce).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startLoanDefaultWorker()).not.toThrow();
    expect(() => stopLoanDefaultWorker()).not.toThrow();
  });
});
