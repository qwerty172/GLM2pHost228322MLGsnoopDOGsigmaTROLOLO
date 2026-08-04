import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN,
  computeHostTier,
  generalHostTier,
  parseGpuVram,
  specsFromPcSpecs,
  STREAM_OVERHEAD,
} from "./hostTier";

describe("hostTier", () => {
  it("parseGpuVram extracts GB from GPU string", () => {
    expect(parseGpuVram("RTX 4070 12 GB")).toBe(12);
    expect(parseGpuVram(null)).toBeNull();
  });

  it("computeHostTier uses weakest-component wins", () => {
    const specs = { gpuVram: 8, cpuCores: 10, ramGb: 18, downloadMbps: 100, uploadMbps: 50 };
    const min = { gpuVram: 4, cpuCores: 4, ramGb: 8, downloadMbps: 25, uploadMbps: 10 };
    const rec = { gpuVram: 8, cpuCores: 8, ramGb: 16, downloadMbps: 75, uploadMbps: 20 };
    expect(computeHostTier(specs, min, rec)).toBe("above_rec");
    expect(computeHostTier({ ...specs, ramGb: 10 }, min, rec)).toBe("meets_min");
  });

  it("generalHostTier defaults unknown specs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
    expect(STREAM_OVERHEAD.cpuCores).toBe(2);
    expect(BASELINE_MIN.ramGb).toBe(8);
  });

  it("specsFromPcSpecs maps pcSpecs", () => {
    const s = specsFromPcSpecs({ gpu: "RTX 3080 10GB", ramGb: 32, cpuCores: 8 });
    expect(s.gpuVram).toBe(10);
    expect(s.ramGb).toBe(32);
  });
});
