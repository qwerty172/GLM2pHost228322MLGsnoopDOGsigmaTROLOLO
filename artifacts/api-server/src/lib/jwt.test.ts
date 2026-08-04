import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCESS_TTL_SEC,
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  verifyAccessJwt,
} from "./jwt";

describe("jwt", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  it("signs and verifies access tokens", async () => {
    const token = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
    expect(ACCESS_TTL_SEC).toBe(900);
  });

  it("hashes refresh tokens deterministically", () => {
    const rt = generateRefreshToken();
    expect(hashRefreshToken(rt)).toMatch(/^[a-f0-9]{64}$/);
  });
});
