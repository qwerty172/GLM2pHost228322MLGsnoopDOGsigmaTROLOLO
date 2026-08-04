import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ACCESS_TTL_SEC,
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  verifyAccessJwt,
} from "./jwt";

describe("jwt", () => {
  const prev = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev;
  });

  it("hashRefreshToken is deterministic sha256 hex", () => {
    const h = hashRefreshToken("abc");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken("abc")).toBe(h);
  });

  it("generateRefreshToken is unique", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("signs and verifies access JWT", async () => {
    expect(ACCESS_TTL_SEC).toBe(900);
    const token = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
  });
});
