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
});
