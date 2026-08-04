import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parses Steam HTML requirements", () => {
    const { min, rec } = parseSteamPcRequirements({
      pc_requirements: {
        minimum: "<strong>Memory:</strong> 8 GB RAM<br><strong>Graphics:</strong> 4 GB VRAM",
        recommended: "<strong>Memory:</strong> 16 GB RAM",
      },
    });
    expect(min.ramGb).toBe(8);
    expect(min.gpuVram).toBe(4);
    expect(rec.ramGb).toBe(16);
  });

  it("recSpecsToJson nulls undefined fields", () => {
    expect(recSpecsToJson({ gpuVram: 8, cpuCores: null, ramGb: 16, downloadMbps: null, uploadMbps: null })).toEqual({
      gpuVram: 8,
      cpuCores: null,
      ramGb: 16,
      downloadMbps: null,
      uploadMbps: null,
    });
  });
});
