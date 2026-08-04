import { describe, expect, it } from "vitest";

describe("legacyBackfill", () => {
  it("module exports runLegacyBackfill", async () => {
    const mod = await import("./legacyBackfill");
    expect(typeof mod.runLegacyBackfill).toBe("function");
  });
});
