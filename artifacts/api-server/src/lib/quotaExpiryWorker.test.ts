import { describe, expect, it } from "vitest";
import { startQuotaExpiryWorker, stopQuotaExpiryWorker } from "./quotaExpiryWorker";

describe("quotaExpiryWorker", () => {
  it("exports start/stop", () => {
    expect(typeof startQuotaExpiryWorker).toBe("function");
    expect(typeof stopQuotaExpiryWorker).toBe("function");
  });
});
