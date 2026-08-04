import { describe, expect, it } from "vitest";
import { startInterestWorker, stopInterestWorker } from "./interestWorker";

describe("interestWorker", () => {
  it("start/stop without throwing", () => {
    startInterestWorker();
    stopInterestWorker();
    expect(true).toBe(true);
  });
});
