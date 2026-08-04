import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";
import type { Quota, hostsTable } from "@workspace/db";

const mkHost = (overrides: Partial<typeof hostsTable.$inferSelect> = {}) =>
  ({
    id: "h1",
    gameId: "g1",
    pcSpecs: { gpu: "RTX 4070 12 GB", ramGb: 32, cpuCores: 8, downloadMbps: 100, uploadMbps: 50 },
    ...overrides,
  }) as typeof hostsTable.$inferSelect;

const mkQuota = (overrides: Partial<Quota> = {}) =>
  ({
    gameId: "g1",
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
    ...overrides,
  }) as Quota;

describe("checkQuotaAttachment", () => {
  it("allows matching game binding", () => {
    expect(checkQuotaAttachment(mkQuota(), mkHost(), "g1")).toEqual({ ok: true });
  });

  it("rejects wrong game", () => {
    const r = checkQuotaAttachment(mkQuota({ gameId: "g2" }), mkHost(), "g1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("different game");
  });
});
