import { describe, it, expect } from "vitest";
import type { Quota } from "@workspace/db";
import type { hostsTable } from "@workspace/db";
import { checkQuotaAttachment } from "./quotaAttach";

type Host = typeof hostsTable.$inferSelect;

function makeQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "quota-1",
    ownerId: "owner-1",
    gameId: null,
    requiredTier: "min",
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

function makeHost(overrides: Partial<Host> = {}): Host {
  return {
    id: "host-1",
    hostToken: "host-token",
    pcSpecs: null,
    gameId: null,
    ...overrides,
  } as Host;
}

describe("checkQuotaAttachment", () => {
  it("allows attach when quota has no hardware requirements and host has no pcSpecs", () => {
    const result = checkQuotaAttachment(makeQuota(), makeHost(), null);
    expect(result).toEqual({ ok: true });
  });

  it("rejects attach when quota has min GPU requirement but host never reported pcSpecs", () => {
    const result = checkQuotaAttachment(
      makeQuota({ minGpuVram: 12 }),
      makeHost({ pcSpecs: null }),
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("не сообщил характеристики");
    }
  });

  it("rejects attach when quota requires recommended tier but host has no pcSpecs", () => {
    const result = checkQuotaAttachment(
      makeQuota({ requiredTier: "recommended" }),
      makeHost({ pcSpecs: null }),
      null,
    );
    expect(result.ok).toBe(false);
  });

  it("evaluates tier when host has pcSpecs", () => {
    const result = checkQuotaAttachment(
      makeQuota({ minGpuVram: 12, minRamGb: 32 }),
      makeHost({
        pcSpecs: { gpu: "GTX 1050 2GB", ramGb: 4, cpuCores: 2 },
      }),
      null,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("ниже минимальных требований");
    }
  });
});
