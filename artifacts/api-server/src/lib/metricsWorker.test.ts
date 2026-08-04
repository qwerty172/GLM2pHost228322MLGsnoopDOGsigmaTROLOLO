import { describe, expect, it } from "vitest";
import { startMetricsWorker } from "./metricsWorker";

describe("metricsWorker", () => {
  it("exports startMetricsWorker", () => {
    expect(typeof startMetricsWorker).toBe("function");
  });
});
