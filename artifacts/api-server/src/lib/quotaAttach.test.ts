import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";
import type { Quota } from "@workspace/db";

describe("quotaAttach", () => {
  const quota = {
    id: "q1",
    gameId: "game-a",
    minGpuVram: 8,
    minCpuCores: 4,
    minRamGb: 8,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
  } as Quota;

  const host = {
    id: "h1",
    gameId: "game-a",
    pcSpecs: { gpu: "RTX 3080 10GB", ramGb: 32, cpuCores: 8, downloadMbps: 100, uploadMbps: 20 },
  } as never;

  it("rejects wrong game binding", () => {
    expect(checkQuotaAttachment(quota, host, "game-b").ok).toBe(false);
  });

  it("allows host meeting min specs", () => {
    expect(checkQuotaAttachment(quota, host, "game-a").ok).toBe(true);
  });

  it("allows host without pcSpecs telemetry", () => {
    expect(checkQuotaAttachment(quota, { ...host, pcSpecs: null }, "game-a").ok).toBe(true);
  });
});
