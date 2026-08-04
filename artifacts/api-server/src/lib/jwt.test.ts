import { describe, expect, it, beforeAll } from "vitest";
import {
  ACCESS_TTL_SEC,
  WS_TICKET_TTL_SEC,
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  signWsTicket,
  verifyAccessJwt,
  verifyWsTicket,
} from "./jwt";

describe("jwt", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  it("exports TTL constants", () => {
    expect(ACCESS_TTL_SEC).toBe(15 * 60);
    expect(WS_TICKET_TTL_SEC).toBe(5 * 60);
  });

  it("hashes and generates refresh tokens", () => {
    const tok = generateRefreshToken();
    expect(tok.length).toBeGreaterThan(20);
    expect(hashRefreshToken(tok)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("signs and verifies access JWT", async () => {
    const jwt = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(jwt);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
    expect(claims?.kind).toBe("access");
  });

  it("signs and verifies WS ticket", async () => {
    const ticket = await signWsTicket("host-1", "host", "sess-1");
    const claims = await verifyWsTicket(ticket);
    expect(claims?.sub).toBe("host-1");
    expect(claims?.sessionId).toBe("sess-1");
    expect(claims?.kind).toBe("ws-ticket");
  });
});
