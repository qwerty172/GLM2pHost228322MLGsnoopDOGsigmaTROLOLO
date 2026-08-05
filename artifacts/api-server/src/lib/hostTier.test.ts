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

  it("computes tier from specs and thresholds", () => {
    const specs = specsFromPcSpecs({
      gpu: "GTX 1050 4 GB",
      ramGb: 10,
      cpuCores: 6,
      uploadMbps: 15,
      downloadMbps: 30,
    });
    expect(computeHostTier(specs, BASELINE_MIN, BASELINE_REC)).toBe("meets_min");
    expect(generalHostTier(null)).toBe("meets_min");
  });

  it("applies STREAM_OVERHEAD on top of min thresholds", () => {
    const minCpu = BASELINE_MIN.cpuCores + STREAM_OVERHEAD.cpuCores;
    const specs = specsFromPcSpecs({
      gpu: "GTX 1050 4 GB",
      ramGb: 16,
      cpuCores: minCpu - 1,
      uploadMbps: 30,
      downloadMbps: 30,
    });
    expect(computeHostTier(specs, BASELINE_MIN, BASELINE_REC)).toBe("below_min");
    expect(STREAM_OVERHEAD.uploadMbps).toBeGreaterThan(0);
  });
});
