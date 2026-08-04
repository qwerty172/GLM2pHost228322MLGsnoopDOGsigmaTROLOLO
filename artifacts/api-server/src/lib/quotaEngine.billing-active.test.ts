import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  hostsTable: {},
  playersTable: {},
  quotasTable: {},
  quotaSessionsTable: {},
  billingEventsTable: {},
}));

import { isQuotaBillingActive } from "./quotaEngine";
import type { Quota } from "@workspace/db";

function baseQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q-1",
    ownerType: "player",
    ownerId: "p-1",
    kind: "sponsor",
    status: "active",
    title: "test",
    description: null,
    visibility: "public",
    accessCode: null,
    gameId: null,
    devKeyId: null,
    royaltyBasis: null,
    royaltyValue: null,
    royaltySource: null,
    budgetLzt: 1000,
    sponsorHostPerMinuteLzt: 0,
    sponsorPlayerPerMinuteLzt: 10,
    escrowRemainingLzt: 500,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: new Date("2026-08-04T02:00:00Z"),
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
    requiredTier: "min",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

describe("isQuotaBillingActive", () => {
  const afterEnd = new Date("2026-08-04T03:00:00Z");
  const beforeEnd = new Date("2026-08-04T01:00:00Z");

  it("is active before end_at", () => {
    const q = baseQuota();
    expect(isQuotaBillingActive(q, beforeEnd)).toBe(true);
  });

  it("is inactive after end_at without grandfather", () => {
    const q = baseQuota();
    expect(isQuotaBillingActive(q, afterEnd)).toBe(false);
  });

  it("grandfathers in-flight sessions past end_at", () => {
    const q = baseQuota();
    expect(
      isQuotaBillingActive(q, afterEnd, { grandfatherPastEndAt: true }),
    ).toBe(true);
  });

  it("does not grandfather when sponsor escrow is empty", () => {
    const q = baseQuota({ escrowRemainingLzt: 0 });
    expect(
      isQuotaBillingActive(q, afterEnd, { grandfatherPastEndAt: true }),
    ).toBe(false);
  });
});
