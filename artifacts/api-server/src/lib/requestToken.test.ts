import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  headerUserToken,
  hostTokenFromRequest,
  TOKEN_PLACEHOLDER,
  USER_TOKEN_HEADER,
} from "./requestToken";

describe("requestToken", () => {
  it("exports header constants", () => {
    expect(USER_TOKEN_HEADER).toBe("x-user-token");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("headerUserToken reads X-User-Token", () => {
    expect(
      headerUserToken({ headers: { [USER_TOKEN_HEADER]: "user-1" } } as Request),
    ).toBe("user-1");
    expect(headerUserToken({ headers: {} } as Request)).toBeNull();
  });

  it("hostTokenFromRequest prefers Bearer then X-Host-Token", () => {
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
    expect(
      hostTokenFromRequest({
        headers: { authorization: "Bearer ", "x-host-token": "fallback" },
      } as Request),
    ).toBe("fallback");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });
});
