import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parses Steam HTML requirements", () => {
    const parsed = parseSteamPcRequirements({
      pc_requirements: {
        minimum: "<strong>Memory:</strong> 8 GB RAM<br><strong>Graphics:</strong> 4 GB video",
        recommended: "<strong>Memory:</strong> 16 GB RAM",
      },
    });
    expect(parsed.min.ramGb).toBe(8);
    expect(parsed.rec.ramGb).toBe(16);
    expect(recSpecsToJson(parsed.rec).ramGb).toBe(16);
  });
});
