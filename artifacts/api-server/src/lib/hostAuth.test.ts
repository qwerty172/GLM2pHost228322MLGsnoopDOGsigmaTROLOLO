import { describe, expect, it } from "vitest";
import type { Request } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { hostTokenFromRequest } = await import("./hostAuth");

describe("hostAuth", () => {
  it("re-exports hostTokenFromRequest", () => {
    const req = { headers: { authorization: "Bearer host-abc" } } as Request;
    expect(hostTokenFromRequest(req)).toBe("host-abc");
  });
});
