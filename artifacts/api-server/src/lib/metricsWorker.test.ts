import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("metricsWorker", () => {
  it("exports metrics worker starter", async () => {
    const mod = await import("./metricsWorker");
    expect(typeof mod.startMetricsWorker).toBe("function");
  });

  it("computeQualityScore penalizes loss, RTT, and low bitrate", async () => {
    const { computeQualityScore } = await import("./metricsWorker");
    expect(computeQualityScore(30, 0, 5000)).toBe(100);
    expect(computeQualityScore(150, 10, 5000)).toBe(40); // -50 loss, -10 RTT
    expect(computeQualityScore(30, 0, 1000)).toBe(90); // -10 low bitrate
    expect(computeQualityScore(500, 20, 500)).toBe(10); // heavy penalties, clamped above 0
  });
});
