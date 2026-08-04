import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Quota } from "@workspace/db";
import { assertQuotaMayAttachToHostSession } from "../lib/quotaAttach";

function makeQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    title: "Test",
    kind: "sponsor",
    status: "active",
    visibility: "public",
    ownerType: "player",
    ownerId: "p1",
    gameId: "game-a",
    accessCode: "secret",
    devKeyId: null,
    minGpuVram: 8,
    minCpuCores: 4,
    minRamGb: 16,
    minDownloadMbps: 50,
    minUploadMbps: 10,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
    requiredTier: "minimum",
    escrowRemainingLzt: 1000,
    royaltyValue: null,
    startAt: null,
    endAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

const hostWithSpecs = {
  id: "h1",
  gameId: "game-b",
  pcSpecs: {
    gpu: "RTX 3060",
    gpuVram: 12,
    cpuCores: 8,
    ramGb: 32,
    downloadMbps: 100,
    uploadMbps: 50,
  },
} as const;

describe("assertQuotaMayAttachToHostSession", () => {
  it("rejects dev-key-exclusive quotas", () => {
    const result = assertQuotaMayAttachToHostSession(
      makeQuota({ devKeyId: "key-1" }),
      hostWithSpecs,
      "game-b",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /API key/i);
  });

  it("rejects private quota without access code", () => {
    const result = assertQuotaMayAttachToHostSession(
      makeQuota({ visibility: "private" }),
      hostWithSpecs,
      "game-b",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /access code/i);
  });

  it("rejects quota bound to a different game", () => {
    const result = assertQuotaMayAttachToHostSession(
      makeQuota({ gameId: "game-a" }),
      hostWithSpecs,
      "game-b",
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /different game/i);
  });

  it("allows public quota when game and specs match", () => {
    const result = assertQuotaMayAttachToHostSession(
      makeQuota({ gameId: "game-b" }),
      hostWithSpecs,
      "game-b",
    );
    assert.equal(result.ok, true);
  });
});
