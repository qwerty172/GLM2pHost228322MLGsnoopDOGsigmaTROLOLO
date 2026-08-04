import { describe, expect, it } from "vitest";
import { parseSteamPcRequirements, recSpecsToJson } from "./steamSpecs";

describe("steamSpecs", () => {
  it("parses Steam pc_requirements HTML", () => {
    const parsed = parseSteamPcRequirements({
      pc_requirements: {
        minimum:
          "<strong>Memory:</strong> 8 GB RAM<br><strong>Graphics:</strong> GTX 1060 6 GB",
        recommended: "<strong>Memory:</strong> 16 GB RAM",
      },
    });
    expect(parsed.min.ramGb).toBe(8);
    expect(parsed.min.gpuVram).toBe(6);
    expect(parsed.rec.ramGb).toBe(16);
  });

  it("recSpecsToJson returns nullable fields", () => {
    const json = recSpecsToJson({ gpuVram: 8, cpuCores: null, ramGb: 16, downloadMbps: 75, uploadMbps: 20 });
    expect(json.gpuVram).toBe(8);
    expect(json.cpuCores).toBeNull();
  });
});
