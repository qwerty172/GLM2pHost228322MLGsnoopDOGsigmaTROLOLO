import { describe, expect, it } from "vitest";
import { startQuotaExpiryWorker } from "./quotaExpiryWorker";

describe("quotaExpiryWorker", () => {
  it("exports startQuotaExpiryWorker", () => {
    expect(typeof startQuotaExpiryWorker).toBe("function");
  });
});
