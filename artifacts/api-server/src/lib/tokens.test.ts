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
  it("uses safe alphabet only", () => {
    const code = generateJoinCode(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });
});

describe("isJoinCodeSlug", () => {
  it("detects short join codes vs long player tokens", () => {
    expect(isJoinCodeSlug("ABCDEFGH")).toBe(true);
    expect(isJoinCodeSlug("abcdefgh")).toBe(true);
    expect(isJoinCodeSlug("not-a-join-code-token-xyz")).toBe(false);
    expect(isJoinCodeSlug("O0I1")).toBe(false);
  });
});
