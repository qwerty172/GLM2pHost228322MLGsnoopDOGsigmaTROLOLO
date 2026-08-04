import { describe, expect, it } from "vitest";
import type { Quota } from "@workspace/db";
import { checkQuotaAttachment } from "./quotaAttach";

function hostRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "h1",
    gameId: "g1",
    pcSpecs: { gpu: "RTX 3060 8 GB", ramGb: 16, cpuCores: 8, uploadMbps: 30 },
    ...overrides,
  } as Parameters<typeof checkQuotaAttachment>[1];
}

function quotaRow(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    gameId: "g2",
    minGpuVram: 4,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: null,
    minUploadMbps: 10,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
    requiredTier: "minimum",
    ...overrides,
  } as Quota;
}

describe("checkQuotaAttachment", () => {
  it("rejects quota bound to another game", () => {
    const result = checkQuotaAttachment(quotaRow(), hostRow(), "g1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("different game");
    }
  });

  it("allows attachment when specs are sufficient", () => {
    const result = checkQuotaAttachment(
      quotaRow({ gameId: "g1", minGpuVram: 4, minRamGb: 8 }),
      hostRow(),
      "g1",
    );
    expect(result).toEqual({ ok: true });
  });
});
