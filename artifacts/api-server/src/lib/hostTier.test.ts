import { describe, expect, it } from "vitest";
import {
  BASELINE_MIN,
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

  it("computeHostTier uses weakest-component wins", () => {
    const specs = specsFromPcSpecs({
      gpu: "RTX 4090 24GB",
      ramGb: 4,
      cpuCores: 16,
    });
    const tier = computeHostTier(specs, BASELINE_MIN, BASELINE_MIN);
    expect(tier).toBe("below_min");
  });

  it("generalHostTier defaults unknown pcSpecs to meets_min", () => {
    expect(generalHostTier(null)).toBe("meets_min");
  });
});
