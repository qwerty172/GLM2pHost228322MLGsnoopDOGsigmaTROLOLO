import { describe, expect, it } from "vitest";
import { runLegacyBackfill } from "./legacyBackfill";

describe("legacyBackfill", () => {
  it("exports runLegacyBackfill", () => {
    expect(typeof runLegacyBackfill).toBe("function");
  });
});
