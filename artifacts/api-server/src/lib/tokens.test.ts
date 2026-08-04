import { describe, expect, it } from "vitest";
import { generateJoinCode, generateToken, isJoinCodeSlug } from "./tokens";

describe("tokens", () => {
  it("generates url-safe tokens", () => {
    expect(generateToken().length).toBeGreaterThan(10);
    expect(generateJoinCode(8)).toHaveLength(8);
  });

  it("detects join-code slugs", () => {
    expect(isJoinCodeSlug("ABCD2345")).toBe(true);
    expect(isJoinCodeSlug("very-long-player-token-uuid")).toBe(false);
    expect(isJoinCodeSlug("ABCD0OIL")).toBe(false);
  });
});
