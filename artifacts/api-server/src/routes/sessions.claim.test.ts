import { describe, it, expect } from "vitest";
import { shouldApplyBlockOnClaim } from "../lib/sessionsClaim";

describe("shouldApplyBlockOnClaim", () => {
  it("applies block fields on first claim when blockMinutes is set", () => {
    expect(shouldApplyBlockOnClaim(false, 25)).toBe(true);
  });

  it("skips block fields on reconnect even when blockMinutes is sent", () => {
    expect(shouldApplyBlockOnClaim(true, 25)).toBe(false);
  });

  it("skips block fields when no block was requested", () => {
    expect(shouldApplyBlockOnClaim(false, null)).toBe(false);
  });
});
