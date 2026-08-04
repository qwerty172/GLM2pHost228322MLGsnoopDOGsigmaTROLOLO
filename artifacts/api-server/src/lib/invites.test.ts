import { describe, expect, it } from "vitest";
import { defaultInviteExpiresAt, isInviteExpired } from "./invites";

describe("invites", () => {
  it("defaults expiry to +7 days", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const expires = defaultInviteExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("detects expired invites", () => {
    expect(isInviteExpired(null)).toBe(false);
    expect(isInviteExpired(new Date(Date.now() + 60_000))).toBe(false);
    expect(isInviteExpired(new Date(Date.now() - 60_000))).toBe(true);
  });
});
