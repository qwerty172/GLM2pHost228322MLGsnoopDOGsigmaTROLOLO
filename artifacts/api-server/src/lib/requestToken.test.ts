import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { TOKEN_PLACEHOLDER, USER_TOKEN_HEADER, headerUserToken, hostTokenFromRequest } from "./requestToken";

describe("requestToken", () => {
  it("exports header constants", () => {
    expect(USER_TOKEN_HEADER).toBe("x-user-token");
    expect(TOKEN_PLACEHOLDER).toBe("@me");
  });

  it("hostTokenFromRequest prefers Bearer then X-Host-Token", () => {
    expect(hostTokenFromRequest({ headers: { authorization: "Bearer tok" } } as Request)).toBe("tok");
    expect(hostTokenFromRequest({ headers: { "x-host-token": "hdr" } } as Request)).toBe("hdr");
    expect(hostTokenFromRequest({ headers: {} } as Request)).toBeNull();
  });

  it("headerUserToken reads X-User-Token", () => {
    expect(headerUserToken({ headers: { [USER_TOKEN_HEADER]: "  user-tok  " } } as Request)).toBe("user-tok");
    expect(headerUserToken({ headers: {} } as Request)).toBeNull();
  });
});
