import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parses minimum requirements from Steam HTML", () => {
    const parsed = parseSteamPcRequirements({
      pc_requirements: {
        minimum:
          "<strong>Memory:</strong> 16 GB RAM<br><strong>Graphics:</strong> 8 GB VRAM",
      },
    });
    expect(parsed.min.ramGb).toBe(16);
    expect(parsed.min.gpuVram).toBe(8);
  });

  it("serializes recommended specs to JSON", () => {
    expect(
      recSpecsToJson({
        gpuVram: 8,
        cpuCores: 4,
        ramGb: 16,
        downloadMbps: null,
        uploadMbps: 20,
      }),
    ).toEqual({
      gpuVram: 8,
      cpuCores: 4,
      ramGb: 16,
      downloadMbps: null,
      uploadMbps: 20,
    });
  });
});
