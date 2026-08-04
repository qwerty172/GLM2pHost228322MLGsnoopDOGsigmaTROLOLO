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

  it("hashes refresh tokens deterministically", () => {
    expect(hashRefreshToken("abc")).toHaveLength(64);
    expect(generateRefreshToken().length).toBeGreaterThan(20);
    expect(ACCESS_TTL_SEC).toBe(15 * 60);
  });

  it("signs and verifies access JWT", async () => {
    const token = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
  });
});
