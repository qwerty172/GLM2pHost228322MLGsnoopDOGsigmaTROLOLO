import { describe, expect, it } from "vitest";
import { startDepositWorker, stopDepositWorker } from "./depositWorker";

describe("depositWorker", () => {
  it("start/stop without throwing", () => {
    startDepositWorker();
    stopDepositWorker();
    expect(true).toBe(true);
  });
});
