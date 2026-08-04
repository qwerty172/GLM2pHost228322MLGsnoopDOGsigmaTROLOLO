import { describe, expect, it } from "vitest";
import { runInterestPayoutOnce, startInterestWorker, stopInterestWorker } from "./interestWorker";

describe("interestWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startInterestWorker).toBe("function");
    expect(typeof stopInterestWorker).toBe("function");
    expect(typeof runInterestPayoutOnce).toBe("function");
  });
});
