import { describe, expect, it } from "vitest";
import { startDepositWorker, stopDepositWorker, runDepositPollOnce } from "./depositWorker";

describe("depositWorker", () => {
  it("exports worker controls", () => {
    expect(typeof startDepositWorker).toBe("function");
    expect(typeof stopDepositWorker).toBe("function");
    expect(typeof runDepositPollOnce).toBe("function");
  });
});
