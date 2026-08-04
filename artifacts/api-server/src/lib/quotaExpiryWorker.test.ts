import { describe, expect, it } from "vitest";
import { startQuotaExpiryWorker, stopQuotaExpiryWorker } from "./quotaExpiryWorker";

describe("quotaExpiryWorker", () => {
  it("start/stop without throwing", () => {
    startQuotaExpiryWorker();
    stopQuotaExpiryWorker();
    expect(true).toBe(true);
  });
});
