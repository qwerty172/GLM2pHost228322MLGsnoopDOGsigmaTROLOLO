import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  TOKEN_PLACEHOLDER,
  USER_TOKEN_HEADER,
  headerUserToken,
  hostTokenFromRequest,
} from "./requestToken";

describe("requestToken", () => {
  it("exports header constants", () => {
    expect(USER_TOKEN_HEADER).toBe("x-user-token");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("hostTokenFromRequest prefers Bearer then headers", () => {
    expect(
      hostTokenFromRequest({
        headers: { authorization: "Bearer host-bearer" },
      } as Request),
    ).toBe("host-bearer");
    expect(
      hostTokenFromRequest({
        headers: { "x-host-token": "host-header" },
      } as Request),
    ).toBe("host-header");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });

  it("headerUserToken reads x-user-token", () => {
    expect(
      headerUserToken({ headers: { "x-user-token": "player-1" } } as Request),
    ).toBe("player-1");
  });
});
