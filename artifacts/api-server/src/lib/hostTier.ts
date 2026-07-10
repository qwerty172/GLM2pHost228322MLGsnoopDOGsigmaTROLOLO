// Host "strength" tiering — turns raw pcSpecs into a simple two-notch label
// relative to a set of requirement thresholds (either a quota's own min*/rec*
// fields, or the site-wide baseline used for the host's general badge).
//
// Only two tiers are exposed to users for now:
//   "below_min"   — fails at least one min* threshold (hard floor, can never
//                    attach to the quota / is flagged weak in general).
//   "meets_min"   — clears every min* threshold, but not every rec* one.
//   "above_rec"   — clears every min* AND every rec* threshold.
//
// Two important nuances baked in here:
//  1. Tiering is "weakest component wins" — a host with a great GPU but RAM
//     that only meets the floor is still just "meets_min" overall, never
//     averaged up.
//  2. Hosts also spend CPU/GPU/network encoding the stream itself, which is
//     on top of whatever the game itself needs. We add a fixed STREAM_OVERHEAD
//     on top of the raw requirement before comparing, so "meets_min" actually
//     means "meets the game's needs AND can still encode the stream".

export const STREAM_OVERHEAD = {
  cpuCores: 2,
  ramGb: 2,
  gpuVram: 0, // encoding uses GPU compute more than extra VRAM; no bump here
  uploadMbps: 5, // headroom above the raw bitrate requirement
  downloadMbps: 0,
} as const;

// Site-wide baseline used for a host's general (not quota-specific) tier
// badge, e.g. shown on the host's own dashboard/profile. Mirrors the numbers
// the AI spec-suggester defaults to for "generic 1080p60 streaming".
export const BASELINE_MIN = {
  gpuVram: 4,
  cpuCores: 4,
  ramGb: 8,
  downloadMbps: 25,
  uploadMbps: 10,
} as const;

export const BASELINE_REC = {
  gpuVram: 8,
  cpuCores: 8,
  ramGb: 16,
  downloadMbps: 75,
  uploadMbps: 20,
} as const;

export type HostTier = "below_min" | "meets_min" | "above_rec";

export interface HostSpecsInput {
  gpuVram: number | null; // parsed VRAM in GB, null = unknown
  cpuCores: number | null;
  ramGb: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export interface TierThresholds {
  gpuVram: number | null | undefined;
  cpuCores: number | null | undefined;
  ramGb: number | null | undefined;
  downloadMbps: number | null | undefined;
  uploadMbps: number | null | undefined;
}

// Returns true if the host clears every defined threshold. Thresholds that
// are null/undefined are skipped (no requirement). Host fields that are null
// (not yet measured) never cause a failure — we don't want to punish hosts
// for missing telemetry, only for measured specs that fall short.
function clearsAll(
  specs: HostSpecsInput,
  thresholds: TierThresholds,
  overhead: typeof STREAM_OVERHEAD,
): boolean {
  const checks: Array<[keyof HostSpecsInput, keyof typeof STREAM_OVERHEAD]> = [
    ["gpuVram", "gpuVram"],
    ["cpuCores", "cpuCores"],
    ["ramGb", "ramGb"],
    ["downloadMbps", "downloadMbps"],
    ["uploadMbps", "uploadMbps"],
  ];
  for (const [specKey, overheadKey] of checks) {
    const threshold = thresholds[specKey];
    if (threshold == null) continue;
    const hostValue = specs[specKey];
    if (hostValue == null) continue; // unmeasured — don't block
    if (hostValue < threshold + overhead[overheadKey]) return false;
  }
  return true;
}

export function computeHostTier(
  specs: HostSpecsInput,
  minThresholds: TierThresholds,
  recThresholds: TierThresholds,
): HostTier {
  if (!clearsAll(specs, minThresholds, STREAM_OVERHEAD)) return "below_min";
  if (!clearsAll(specs, recThresholds, STREAM_OVERHEAD)) return "meets_min";
  return "above_rec";
}

// Convenience: parse the "12GB" / "RTX 4070 12 GB" style GPU name string used
// throughout the codebase into a VRAM number.
export function parseGpuVram(gpuName: string | null | undefined): number | null {
  if (!gpuName) return null;
  const m = gpuName.match(/(\d+)\s*GB/i);
  return m ? parseInt(m[1], 10) : null;
}

export function specsFromPcSpecs(
  pcSpecs: {
    gpu: string;
    ramGb: number;
    cpuCores?: number;
    downloadMbps?: number;
    uploadMbps?: number;
  } | null | undefined,
): HostSpecsInput {
  if (!pcSpecs) {
    return {
      gpuVram: null,
      cpuCores: null,
      ramGb: null,
      downloadMbps: null,
      uploadMbps: null,
    };
  }
  return {
    gpuVram: parseGpuVram(pcSpecs.gpu),
    cpuCores: pcSpecs.cpuCores ?? null,
    ramGb: pcSpecs.ramGb,
    downloadMbps: pcSpecs.downloadMbps ?? null,
    uploadMbps: pcSpecs.uploadMbps ?? null,
  };
}

// The host's general tier badge, computed against the site-wide baseline
// (not tied to any specific quota/game).
export function generalHostTier(
  pcSpecs: Parameters<typeof specsFromPcSpecs>[0],
): HostTier {
  return computeHostTier(specsFromPcSpecs(pcSpecs), BASELINE_MIN, BASELINE_REC);
}
