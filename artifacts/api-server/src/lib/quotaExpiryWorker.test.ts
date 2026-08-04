import { describe, expect, it, afterEach } from "vitest";
import { startQuotaExpiryWorker, stopQuotaExpiryWorker } from "./quotaExpiryWorker";

describe("quotaExpiryWorker", () => {
  afterEach(() => {
    stopQuotaExpiryWorker();
  });

  it("exports start/stop", () => {
    expect(typeof startQuotaExpiryWorker).toBe("function");
    expect(typeof stopQuotaExpiryWorker).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startQuotaExpiryWorker()).not.toThrow();
    expect(() => stopQuotaExpiryWorker()).not.toThrow();
  });
});
