import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("metricsWorker", () => {
  it("exports metrics worker starter", async () => {
    const mod = await import("./metricsWorker");
    expect(typeof mod.startMetricsWorker).toBe("function");
  });
});
