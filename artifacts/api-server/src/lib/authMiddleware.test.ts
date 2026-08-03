import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { requireAuth, requireHostMiddleware } = await import("./authMiddleware");

describe("authMiddleware", () => {
  it("requireAuth rejects missing credentials", async () => {
    const middleware = requireAuth();
    const req = { headers: {}, query: {} } as Request;
    let status = 0;
    let body: unknown;
    const res = {
      status: (code: number) => {
        status = code;
        return { json: (b: unknown) => { body = b; } };
      },
    } as unknown as Response;
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(nextCalled).toBe(false);
    expect(status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("requireHostMiddleware rejects missing host token", async () => {
    const middleware = requireHostMiddleware();
    const req = { headers: {} } as Request;
    let status = 0;
    let body: unknown;
    const res = {
      status: (code: number) => {
        status = code;
        return { json: (b: unknown) => { body = b; } };
      },
    } as unknown as Response;
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(nextCalled).toBe(false);
    expect(status).toBe(401);
    expect(body).toEqual({ error: "hostToken required in Authorization or X-Host-Token" });
  });
});
