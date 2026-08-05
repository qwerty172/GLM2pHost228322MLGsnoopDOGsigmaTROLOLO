import { describe, expect, it, beforeAll } from "vitest";
import {
  ACCESS_TTL_SEC,
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  signWsTicket,
  verifyAccessJwt,
  verifyWsTicket,
  WS_TICKET_TTL_SEC,
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

  it("generates unique base64url refresh tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(hashRefreshToken(a)).not.toBe(hashRefreshToken(b));
  });

  it("round-trips WS ticket without sessionId", async () => {
    expect(WS_TICKET_TTL_SEC).toBe(5 * 60);
    const token = await signWsTicket("host-1", "host");
    const claims = await verifyWsTicket(token);
    expect(claims?.sub).toBe("host-1");
    expect(claims?.typ).toBe("host");
    expect(claims?.kind).toBe("ws-ticket");
    expect(claims?.sessionId).toBeUndefined();
  });

  it("round-trips WS ticket with sessionId", async () => {
    const token = await signWsTicket("player-2", "player", "sess-abc");
    const claims = await verifyWsTicket(token);
    expect(claims?.sub).toBe("player-2");
    expect(claims?.typ).toBe("player");
    expect(claims?.sessionId).toBe("sess-abc");
  });

  it("rejects invalid WS ticket", async () => {
    const access = await signAccessJwt("user-1", "player");
    expect(await verifyWsTicket(access)).toBeNull();
    expect(await verifyWsTicket("not-a-jwt")).toBeNull();
  });
});
