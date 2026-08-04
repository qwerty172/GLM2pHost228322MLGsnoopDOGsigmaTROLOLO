import { describe, expect, it, afterEach } from "vitest";
import {
  startInterestWorker,
  stopInterestWorker,
  runInterestPayoutOnce,
} from "./interestWorker";

describe("interestWorker", () => {
  afterEach(() => {
    stopInterestWorker();
  });

  it("exports worker lifecycle and runInterestPayoutOnce", () => {
    expect(typeof startInterestWorker).toBe("function");
    expect(typeof stopInterestWorker).toBe("function");
    expect(typeof runInterestPayoutOnce).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startInterestWorker()).not.toThrow();
    expect(() => stopInterestWorker()).not.toThrow();
  });
});
