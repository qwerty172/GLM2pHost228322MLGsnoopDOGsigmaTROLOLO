import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";

describe("checkQuotaAttachment", () => {
  const quota = {
    gameId: "game-a",
    minGpuVram: 4,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: 25,
    minUploadMbps: 10,
    recGpuVram: 8,
    recCpuCores: 8,
    recRamGb: 16,
    recDownloadMbps: 75,
    recUploadMbps: 20,
    requiredTier: "minimum",
  } as never;

  it("rejects wrong game binding", () => {
    const host = { gameId: "game-b", pcSpecs: null } as never;
    expect(checkQuotaAttachment(quota, host, null)).toEqual({ ok: false, error: "Quota is bound to a different game" });
  });

  it("allows when no pcSpecs", () => {
    const host = { gameId: "game-a", pcSpecs: null } as never;
    expect(checkQuotaAttachment(quota, host, "game-a")).toEqual({ ok: true });
  });
});
