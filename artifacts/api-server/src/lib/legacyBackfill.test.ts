import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("legacyBackfill", () => {
  it("exports backfill runner", async () => {
    const mod = await import("./legacyBackfill");
    expect(typeof mod.runLegacyBackfill).toBe("function");
  });
});
