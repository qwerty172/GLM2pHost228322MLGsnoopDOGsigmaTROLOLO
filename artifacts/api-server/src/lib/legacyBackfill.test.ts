import { describe, expect, it } from "vitest";
import { runLegacyBackfill } from "./legacyBackfill";

describe("legacyBackfill", () => {
  it("runLegacyBackfill is exported", () => {
    expect(typeof runLegacyBackfill).toBe("function");
  });
});
