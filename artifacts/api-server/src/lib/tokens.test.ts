import { describe, expect, it } from "vitest";
import { generateToken, generateJoinCode, isJoinCodeSlug } from "./tokens";

describe("tokens", () => {
  it("generateToken returns url-safe base64", () => {
    const t = generateToken(24);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(30);
  });

  it("generateJoinCode uses unambiguous alphabet", () => {
    const code = generateJoinCode(8);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it("isJoinCodeSlug distinguishes join codes from player tokens", () => {
    expect(isJoinCodeSlug("ABCDEFGH")).toBe(true);
    expect(isJoinCodeSlug("very-long-player-token-value")).toBe(false);
    expect(isJoinCodeSlug("bad0")).toBe(false);
  });
});
