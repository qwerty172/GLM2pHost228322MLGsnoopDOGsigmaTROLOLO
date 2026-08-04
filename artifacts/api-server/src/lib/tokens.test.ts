import { describe, expect, it } from "vitest";
import { generateToken, generateJoinCode, isJoinCodeSlug } from "./tokens";

describe("generateToken", () => {
  it("returns url-safe base64 of expected length", () => {
    const t = generateToken(24);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(30);
  });

  it("produces unique values", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("generateJoinCode", () => {
  it("uses unambiguous charset", () => {
    const code = generateJoinCode(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });
});

describe("isJoinCodeSlug", () => {
  it("detects short join-code slugs", () => {
    expect(isJoinCodeSlug("ABCD2345")).toBe(true);
    expect(isJoinCodeSlug("very-long-player-token-value")).toBe(false);
  });
});
