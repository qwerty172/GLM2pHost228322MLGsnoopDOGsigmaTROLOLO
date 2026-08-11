import { describe, expect, it } from "vitest";
import {
  defaultInviteExpiresAt,
  generateInviteCode,
  isInviteExpired,
  isStaleUnclaimedInviteSession,
} from "./invites";

describe("invites", () => {
  it("generates url-safe invite codes", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(12);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

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

  it("flags stale unclaimed sessions with expired invites", () => {
    const expired = new Date(Date.now() - 60_000);
    const fresh = new Date(Date.now() + 60_000);
    expect(
      isStaleUnclaimedInviteSession({
        status: "pending",
        claimedByPlayerId: null,
        inviteExpiresAt: expired,
      }),
    ).toBe(true);
    expect(
      isStaleUnclaimedInviteSession({
        status: "pending",
        claimedByPlayerId: null,
        inviteExpiresAt: fresh,
      }),
    ).toBe(false);
    expect(
      isStaleUnclaimedInviteSession({
        status: "active",
        claimedByPlayerId: "player-1",
        inviteExpiresAt: expired,
      }),
    ).toBe(false);
    expect(
      isStaleUnclaimedInviteSession({
        status: "pending",
        claimedByPlayerId: null,
        devKeyId: "embed-key",
        inviteExpiresAt: expired,
      }),
    ).toBe(false);
  });
});
