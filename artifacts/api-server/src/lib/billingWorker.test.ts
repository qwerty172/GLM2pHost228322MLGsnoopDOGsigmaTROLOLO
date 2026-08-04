import { describe, expect, it } from "vitest";
import { countSessionMinutesUsed, refundBlockRemainder, startBillingWorker, stopBillingWorker } from "./billingWorker";

describe("billingWorker", () => {
  it("re-exports session billing helpers", () => {
    expect(typeof countSessionMinutesUsed).toBe("function");
    expect(typeof refundBlockRemainder).toBe("function");
  });

  it("exports start/stop", () => {
    expect(typeof startBillingWorker).toBe("function");
    expect(typeof stopBillingWorker).toBe("function");
  });
});
