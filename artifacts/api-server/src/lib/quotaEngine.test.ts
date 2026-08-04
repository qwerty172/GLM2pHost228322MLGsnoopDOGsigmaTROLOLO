import { describe, expect, it } from "vitest";
import { computeQuotaEffect, generateAccessCode, isQuotaActiveNow } from "./quotaEngine";

describe("quotaEngine", () => {
  it("computeQuotaEffect percent royalty", () => {
    const q = { kind: "royalty", royaltyBasis: "percent", royaltyValue: 10, minSessionMinutes: null, maxSessionMinutes: null } as never;
    expect(computeQuotaEffect(q, 100, 5).royaltyLzt).toBe(10);
  });

  it("generateAccessCode returns 8 chars", () => {
    expect(generateAccessCode()).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("isQuotaActiveNow checks status and dates", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isQuotaActiveNow({ status: "active", startAt: null, endAt: null, kind: "royalty" } as never, now)).toBe(true);
    expect(isQuotaActiveNow({ status: "paused", startAt: null, endAt: null, kind: "royalty" } as never, now)).toBe(false);
  });
});
