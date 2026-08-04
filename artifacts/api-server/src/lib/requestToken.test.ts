import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { TOKEN_PLACEHOLDER, USER_TOKEN_HEADER, headerUserToken, hostTokenFromRequest } from "./requestToken";

describe("requestToken", () => {
  it("exports header constants", () => {
    expect(USER_TOKEN_HEADER).toBe("x-user-token");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("hostTokenFromRequest prefers Bearer", () => {
    expect(hostTokenFromRequest({ headers: { authorization: "Bearer tok" } } as Request)).toBe("tok");
    expect(hostTokenFromRequest({ headers: { "x-host-token": "h" } } as Request)).toBe("h");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });

  it("headerUserToken reads x-user-token", () => {
    expect(headerUserToken({ headers: { "x-user-token": "u" } } as Request)).toBe("u");
  });
});
