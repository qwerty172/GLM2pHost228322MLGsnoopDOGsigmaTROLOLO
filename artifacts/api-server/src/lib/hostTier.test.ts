import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN,
  BASELINE_REC,
  computeHostTier,
  generalHostTier,
  parseGpuVram,
  specsFromPcSpecs,
} from "./hostTier";

describe("hostTier", () => {
  it("parseGpuVram extracts GB from GPU name", () => {
    expect(parseGpuVram("RTX 4070 12 GB")).toBe(12);
    expect(parseGpuVram(null)).toBeNull();
  });

  it("computeHostTier uses weakest component", () => {
    const specs = specsFromPcSpecs({
      gpu: "RTX 4090 24 GB",
      ramGb: 18,
      cpuCores: 10,
      downloadMbps: 100,
      uploadMbps: 30,
    });
    const min = { gpuVram: 4, cpuCores: 4, ramGb: 8, downloadMbps: 25, uploadMbps: 10 };
    const rec = { gpuVram: 8, cpuCores: 8, ramGb: 16, downloadMbps: 75, uploadMbps: 20 };
    expect(computeHostTier(specs, min, rec)).toBe("above_rec");
  });

  it("generalHostTier defaults unknown specs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
    expect(generalHostTier(undefined)).toBe("meets_min");
  });

  it("exports baseline constants", () => {
    expect(BASELINE_MIN.ramGb).toBe(8);
    expect(BASELINE_REC.ramGb).toBe(16);
  });
});
