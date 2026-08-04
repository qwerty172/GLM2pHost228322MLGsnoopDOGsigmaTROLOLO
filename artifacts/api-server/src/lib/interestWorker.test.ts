import { describe, expect, it } from "vitest";
import { startInterestWorker, stopInterestWorker, runInterestPayoutOnce } from "./interestWorker";

describe("interestWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startInterestWorker).toBe("function");
    expect(typeof runInterestPayoutOnce).toBe("function");
  });
});
