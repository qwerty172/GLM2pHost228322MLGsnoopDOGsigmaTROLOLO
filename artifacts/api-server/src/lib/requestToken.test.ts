import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  TOKEN_PLACEHOLDER,
  USER_TOKEN_HEADER,
  headerUserToken,
  hostTokenFromRequest,
} from "./requestToken";

describe("requestToken", () => {
  it("reads X-User-Token header", () => {
    const req = { headers: { [USER_TOKEN_HEADER]: " player-tok " } } as Request;
    expect(headerUserToken(req)).toBe("player-tok");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("prefers Authorization Bearer for host token", () => {
    const req = {
      headers: { authorization: "Bearer host-tok", [USER_TOKEN_HEADER]: "player" },
    } as Request;
    expect(hostTokenFromRequest(req)).toBe("host-tok");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });
});
