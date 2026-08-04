import { describe, expect, it } from "vitest";
import { startMetricsWorker } from "./metricsWorker";

describe("metricsWorker", () => {
  it("start without throwing", () => {
    startMetricsWorker();
    expect(true).toBe(true);
  });
});
