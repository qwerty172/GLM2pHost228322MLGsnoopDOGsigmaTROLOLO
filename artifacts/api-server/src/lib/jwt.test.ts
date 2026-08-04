import { describe, expect, it, beforeAll } from "vitest";
import {
  ACCESS_TTL_SEC,
  hashRefreshToken,
  signAccessJwt,
  verifyAccessJwt,
} from "./jwt";

describe("jwt", () => {
  beforeAll(() => {
    process.env.JWT_SECRET ??= "test-jwt-secret-for-marathon-unit-tests";
  });

  it("hashes refresh tokens deterministically", () => {
    const hash = hashRefreshToken("abc");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashRefreshToken("abc")).toBe(hash);
  });

  it("round-trips access JWT", async () => {
    expect(ACCESS_TTL_SEC).toBe(15 * 60);
    const token = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
  });
});
