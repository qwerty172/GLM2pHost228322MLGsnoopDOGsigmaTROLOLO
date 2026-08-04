import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";

describe("checkQuotaAttachment", () => {
  const quota = {
    gameId: "game-a",
    minGpuVram: null,
    minCpuCores: null,
    minRamGb: null,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
    requiredTier: "minimum" as const,
  };

  const host = {
    gameId: "game-a",
    pcSpecs: null,
  } as Parameters<typeof checkQuotaAttachment>[1];

  it("rejects mismatched game binding", () => {
    expect(checkQuotaAttachment(quota, host, "game-b")).toEqual({
      ok: false,
      error: "Quota is bound to a different game",
    });
  });

  it("allows when game matches or pcSpecs missing", () => {
    expect(checkQuotaAttachment(quota, host, "game-a")).toEqual({ ok: true });
    expect(checkQuotaAttachment(quota, host, null)).toEqual({ ok: true });
  });
});
