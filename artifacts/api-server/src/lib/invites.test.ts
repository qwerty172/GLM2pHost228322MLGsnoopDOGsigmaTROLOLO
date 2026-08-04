import { describe, expect, it } from "vitest";
import { defaultInviteExpiresAt, generateInviteCode, isInviteExpired } from "./invites";

describe("invites", () => {
  it("generates codes and expiry helpers", () => {
    expect(generateInviteCode().length).toBeGreaterThanOrEqual(10);
    const from = new Date("2026-01-01T00:00:00Z");
    const expires = defaultInviteExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(isInviteExpired(expires, from)).toBe(false);
  });
});
