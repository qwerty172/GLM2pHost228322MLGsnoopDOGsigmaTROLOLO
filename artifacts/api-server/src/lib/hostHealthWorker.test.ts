import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("hostHealthWorker", () => {
  it("exports worker lifecycle", async () => {
    const mod = await import("./hostHealthWorker");
    expect(typeof mod.startHostHealthWorker).toBe("function");
    expect(typeof mod.stopHostHealthWorker).toBe("function");
  });

  it("isHostHeartbeatStale treats null lastSeenAt as offline", async () => {
    const { isHostHeartbeatStale } = await import("./hostHealthWorker");
    const cutoff = new Date("2026-01-01T00:01:00.000Z");
    expect(isHostHeartbeatStale(null, cutoff)).toBe(true);
    expect(isHostHeartbeatStale(undefined, cutoff)).toBe(true);
    expect(isHostHeartbeatStale(new Date("2026-01-01T00:00:30.000Z"), cutoff)).toBe(
      true,
    );
    expect(isHostHeartbeatStale(new Date("2026-01-01T00:02:00.000Z"), cutoff)).toBe(
      false,
    );
  });
});
