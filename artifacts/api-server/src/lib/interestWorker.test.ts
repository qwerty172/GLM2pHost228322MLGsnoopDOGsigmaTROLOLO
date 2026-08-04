import { describe, expect, it } from "vitest";
import { startInterestWorker } from "./interestWorker";

describe("interestWorker", () => {
  it("exports startInterestWorker", () => {
    expect(typeof startInterestWorker).toBe("function");
  });
});
