import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessJwt,
  verifyAccessJwt,
  signWsTicket,
  verifyWsTicket,
} from "./jwt";

describe("jwt", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests";
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("hashes refresh tokens deterministically", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("xyz"));
  });

  it("generates unique refresh tokens", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("signs and verifies access JWT", async () => {
    const token = await signAccessJwt("user-1", "player");
    const claims = await verifyAccessJwt(token);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.typ).toBe("player");
    expect(claims?.kind).toBe("access");
  });

  it("rejects wrong kind on access verify", async () => {
    const ticket = await signWsTicket("user-1", "host", "sess-1");
    expect(await verifyAccessJwt(ticket)).toBeNull();
  });

  it("signs and verifies WS ticket with sessionId", async () => {
    const token = await signWsTicket("host-1", "host", "session-42");
    const claims = await verifyWsTicket(token);
    expect(claims?.sub).toBe("host-1");
    expect(claims?.kind).toBe("ws-ticket");
    expect(claims?.sessionId).toBe("session-42");
  });
});
