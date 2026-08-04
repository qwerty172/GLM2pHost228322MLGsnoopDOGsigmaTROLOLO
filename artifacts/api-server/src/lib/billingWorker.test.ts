import { describe, expect, it } from "vitest";
import { startBillingWorker, stopBillingWorker } from "./billingWorker";

describe("billingWorker", () => {
  it("start/stop without throwing", () => {
    startBillingWorker();
    stopBillingWorker();
    expect(true).toBe(true);
  });
});
