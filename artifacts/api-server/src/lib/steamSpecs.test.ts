import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parseSteamPcRequirements extracts RAM from HTML", () => {
    const parsed = parseSteamPcRequirements({
      pc_requirements: {
        minimum: "<strong>Memory:</strong> 8 GB RAM",
        recommended: "<strong>Memory:</strong> 16 GB RAM",
      },
    });
    expect(parsed.min.ramGb).toBe(8);
    expect(parsed.rec.ramGb).toBe(16);
  });

  it("recSpecsToJson serializes thresholds", () => {
    const json = recSpecsToJson({ gpuVram: 8, cpuCores: 4, ramGb: 16, downloadMbps: null, uploadMbps: null });
    expect(json.gpuVram).toBe(8);
    expect(json.ramGb).toBe(16);
  });
});
