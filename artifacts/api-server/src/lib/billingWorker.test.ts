import { describe, expect, it } from "vitest";
import { startBillingWorker } from "./billingWorker";

describe("billingWorker", () => {
  it("exports startBillingWorker", () => {
    expect(typeof startBillingWorker).toBe("function");
  });
});
