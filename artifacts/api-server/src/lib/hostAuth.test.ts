import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { hostTokenFromRequest, requireHost } from "./hostAuth";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
  hostsTable: { hostToken: "hostToken" },
}));

describe("hostAuth", () => {
  it("re-exports hostTokenFromRequest", () => {
    expect(
      hostTokenFromRequest({ headers: { authorization: "Bearer tok" } } as Request),
    ).toBe("tok");
  });

  it("requireHost returns 401 without token", async () => {
    const result = await requireHost({ headers: {} } as Request);
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "hostToken required in Authorization or X-Host-Token",
    });
  });

  it("requireHost returns 404 for unknown token", async () => {
    const result = await requireHost({
      headers: { authorization: "Bearer unknown" },
    } as Request);
    expect(result).toEqual({ ok: false, status: 404, error: "Host not found" });
  });
});
