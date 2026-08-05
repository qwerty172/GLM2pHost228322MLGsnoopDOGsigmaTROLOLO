import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret-for-marathon-unit-tests";

const mockVerifyAccessJwt = vi.fn();
vi.mock("./jwt", () => ({
  verifyAccessJwt: (jwt: string) => mockVerifyAccessJwt(jwt),
}));

const queryQueue: unknown[][] = [];

function queueResults(...batches: unknown[][]) {
  queryQueue.push(...batches);
}

function nextResult(): unknown[] {
  return queryQueue.shift() ?? [];
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => nextResult()),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: { id: "id", hostToken: "hostToken" },
  playersTable: { id: "id", playerToken: "playerToken" },
}));

const {
  resolveAuthUser,
  requireAuth,
  requireHostMiddleware,
  requirePlayerMiddleware,
} = await import("./authMiddleware");

describe("resolveAuthUser", () => {
  beforeEach(() => {
    queryQueue.length = 0;
    mockVerifyAccessJwt.mockReset();
  });

  it("resolves JWT Bearer access token", async () => {
    mockVerifyAccessJwt.mockResolvedValue({ sub: "user-1", typ: "player" });
    const req = {
      headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig" },
      query: {},
    } as Request;

    await expect(resolveAuthUser(req)).resolves.toEqual({
      userId: "user-1",
      userType: "player",
      mode: "jwt",
    });
    expect(mockVerifyAccessJwt).toHaveBeenCalledWith("eyJhbGciOiJIUzI1NiJ9.payload.sig");
  });

  it("falls back to legacy opaque token via X-User-Token", async () => {
    queueResults([], [{ id: "player-legacy" }]);
    const req = {
      headers: { "x-user-token": "legacy-player-tok" },
      query: {},
    } as Request;

    await expect(resolveAuthUser(req)).resolves.toEqual({
      userId: "player-legacy",
      userType: "player",
      mode: "legacy",
    });
  });

  it("returns null when no credentials match", async () => {
    const req = { headers: {}, query: {} } as Request;
    await expect(resolveAuthUser(req)).resolves.toBeNull();
  });
});

describe("requirePlayerMiddleware", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("rejects missing X-Player-Wallet-Token", async () => {
    const middleware = requirePlayerMiddleware();
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
    expect(body).toEqual({ error: "X-Player-Wallet-Token required" });
  });

  it("rejects invalid player wallet token", async () => {
    queueResults([]);
    const middleware = requirePlayerMiddleware();
    const req = { headers: { "x-player-wallet-token": "bad-tok" } } as Request;
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
    expect(body).toEqual({ error: "Invalid player wallet token" });
  });

  it("attaches authPlayer and calls next for valid wallet token", async () => {
    const player = { id: "player-1", playerToken: "wallet-tok" };
    queueResults([player]);
    const middleware = requirePlayerMiddleware();
    const req = { headers: { "x-player-wallet-token": "wallet-tok" } } as Request;
    const res = {} as Response;
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(nextCalled).toBe(true);
    expect((req as { authPlayer?: typeof player }).authPlayer).toEqual(player);
  });
});

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
