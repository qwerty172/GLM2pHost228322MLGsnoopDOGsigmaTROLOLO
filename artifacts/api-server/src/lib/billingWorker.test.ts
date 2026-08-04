import { describe, expect, it, afterEach, vi } from "vitest";
import {
  startBillingWorker,
  stopBillingWorker,
  refundBlockRemainder,
  countSessionMinutesUsed,
} from "./billingWorker";

describe("billingWorker", () => {
  afterEach(() => {
    stopBillingWorker();
  });

  it("exports billing helpers re-exported from sessionBilling", () => {
    expect(typeof refundBlockRemainder).toBe("function");
    expect(typeof countSessionMinutesUsed).toBe("function");
  });

  it("start/stop billing worker without throwing", () => {
    expect(() => startBillingWorker()).not.toThrow();
    expect(() => stopBillingWorker()).not.toThrow();
    expect(() => stopBillingWorker()).not.toThrow();
  });
});
