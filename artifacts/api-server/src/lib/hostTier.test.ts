import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN,
  BASELINE_REC,
  STREAM_OVERHEAD,
  computeHostTier,
  generalHostTier,
  parseGpuVram,
  specsFromPcSpecs,
} from "./hostTier";

describe("hostTier", () => {
  it("parses GPU VRAM from name", () => {
    expect(parseGpuVram("RTX 4070 12 GB")).toBe(12);
    expect(parseGpuVram(null)).toBeNull();
  });

  it("computeHostTier uses weakest-component wins", () => {
    const specs = { gpuVram: 12, cpuCores: 10, ramGb: 18, downloadMbps: 100, uploadMbps: 30 };
    const min = { gpuVram: 4, cpuCores: 4, ramGb: 8, downloadMbps: 25, uploadMbps: 10 };
    const rec = { gpuVram: 8, cpuCores: 8, ramGb: 16, downloadMbps: 75, uploadMbps: 20 };
    expect(computeHostTier(specs, min, rec)).toBe("above_rec");
    expect(computeHostTier({ ...specs, ramGb: 6 }, min, rec)).toBe("below_min");
  });

  it("generalHostTier defaults unknown pcSpecs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
    expect(specsFromPcSpecs(null).gpuVram).toBeNull();
  });

  it("exports baseline constants", () => {
    expect(STREAM_OVERHEAD.cpuCores).toBe(2);
    expect(BASELINE_MIN.ramGb).toBe(8);
    expect(BASELINE_REC.ramGb).toBe(16);
  });
});
