import { describe, expect, it } from "vitest";
import { startBillingWorker, stopBillingWorker } from "./billingWorker";

describe("billingWorker", () => {
  it("exports lifecycle functions", () => {
    expect(typeof startBillingWorker).toBe("function");
    expect(typeof stopBillingWorker).toBe("function");
  });
});
