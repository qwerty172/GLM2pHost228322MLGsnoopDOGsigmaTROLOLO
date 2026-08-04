import { describe, expect, it } from "vitest";
import { startDepositWorker } from "./depositWorker";

describe("depositWorker", () => {
  it("exports startDepositWorker", () => {
    expect(typeof startDepositWorker).toBe("function");
  });
});
