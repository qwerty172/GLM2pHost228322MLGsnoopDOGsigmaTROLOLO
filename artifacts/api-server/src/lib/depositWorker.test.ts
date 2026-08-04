import { describe, expect, it, afterEach } from "vitest";
import {
  startDepositWorker,
  stopDepositWorker,
  runDepositPollOnce,
} from "./depositWorker";

describe("depositWorker", () => {
  afterEach(() => {
    stopDepositWorker();
  });

  it("exports worker lifecycle and pollOnce", () => {
    expect(typeof startDepositWorker).toBe("function");
    expect(typeof stopDepositWorker).toBe("function");
    expect(typeof runDepositPollOnce).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startDepositWorker()).not.toThrow();
    expect(() => stopDepositWorker()).not.toThrow();
  });
});
