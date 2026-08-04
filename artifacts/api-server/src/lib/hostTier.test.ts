import { describe, expect, it } from "vitest";
import { BASELINE_MIN, computeHostTier, generalHostTier, parseGpuVram, specsFromPcSpecs } from "./hostTier";

describe("hostTier", () => {
  it("parses GPU VRAM from name", () => {
    expect(parseGpuVram("RTX 4070 12 GB")).toBe(12);
    expect(parseGpuVram(null)).toBeNull();
  });

  it("computes tier from specs", () => {
    const specs = specsFromPcSpecs({ gpu: "RTX 4090 24 GB", ramGb: 32, cpuCores: 16, uploadMbps: 50, downloadMbps: 100 });
    expect(computeHostTier(specs, BASELINE_MIN, { gpuVram: 8, cpuCores: 8, ramGb: 16, downloadMbps: 75, uploadMbps: 20 })).toBe("above_rec");
  });

  it("defaults unknown pcSpecs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
  });
});
