import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { hashRefreshToken } from "../lib/jwt";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";
process.env.JWT_SECRET ??= "test-jwt-secret-for-marathon-unit-tests";

const HOST_TOKEN = "legacy-host-token";
const PLAYER_TOKEN = "legacy-player-token";
const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const HOST_ID = "host-1";
const PLAYER_ID = "player-1";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function chainSelect() {
  const whereResult = vi.fn(async () => nextResult());
  return {
    from: vi.fn(() => ({
      where: whereResult,
    })),
  };
}

function makeWhere() {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(async () => nextResult()),
  });
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: vi.fn(async () => undefined),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
  },
  refreshTokensTable: {
    id: "id",
    userId: "userId",
    userType: "userType",
    tokenHash: "tokenHash",
    expiresAt: "expiresAt",
    revokedAt: "revokedAt",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    claimedByPlayerId: "claimedByPlayerId",
  },
}));

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false),
}));

const { default: authRouter } = await import("./auth");

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, setCookie };
}

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use(authRouter);
  await new Promise<void>((resolve) => {
    server = createServer(app).listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  queryQueue.length = 0;
  vi.clearAllMocks();
  mockDb.select.mockImplementation(() => chainSelect());
  process.env.JWT_SECRET = "test-jwt-secret-for-marathon-unit-tests";
});

describe("POST /auth/login", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/auth/login", { body: {} });
    expect(res.status).toBe(400);
  });

  it("returns 503 when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    const res = await request("POST", "/auth/login", {
      body: { legacyToken: HOST_TOKEN },
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "JWT auth not configured" });
  });

  it("returns 401 for unknown legacy token", async () => {
    queueResults([], []);
    const res = await request("POST", "/auth/login", {
      body: { legacyToken: "unknown-token" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid token" });
  });

  it("issues access token for a valid host legacy token", async () => {
    queueResults([{ id: HOST_ID }]);
    const res = await request("POST", "/auth/login", {
      body: { legacyToken: HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    const body = res.json as { accessToken: string; expiresInSec: number };
    expect(body.accessToken).toBeTruthy();
    expect(body.expiresInSec).toBe(15 * 60);
    expect(res.setCookie.some((c) => c.startsWith("dh_refresh="))).toBe(true);
  });

  it("issues access token for a valid player legacy token", async () => {
    queueResults([], [{ id: PLAYER_ID }]);
    const res = await request("POST", "/auth/login", {
      body: { legacyToken: PLAYER_TOKEN },
    });
    expect(res.status).toBe(200);
    const body = res.json as { accessToken: string; expiresInSec: number };
    expect(body.accessToken).toBeTruthy();
    expect(body.expiresInSec).toBe(15 * 60);
  });
});

describe("POST /auth/refresh", () => {
  it("returns 503 when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    const res = await request("POST", "/auth/refresh", {
      body: { refreshToken: "token" },
    });
    expect(res.status).toBe(503);
  });

  it("returns 401 when refresh token is missing", async () => {
    const res = await request("POST", "/auth/refresh", { body: {} });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Refresh token required" });
  });

  it("returns 401 for invalid refresh token", async () => {
    queueResults([]);
    const res = await request("POST", "/auth/refresh", {
      body: { refreshToken: "invalid-refresh" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid refresh token" });
  });

  it("rotates refresh token and returns new access token", async () => {
    const rawRefresh = "valid-refresh-token-value";
    const tokenHash = hashRefreshToken(rawRefresh);
    queueResults([
      {
        id: "rt-1",
        userId: HOST_ID,
        userType: "host",
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      },
    ]);
    const res = await request("POST", "/auth/refresh", {
      body: { refreshToken: rawRefresh },
    });
    expect(res.status).toBe(200);
    const body = res.json as { accessToken: string; expiresInSec: number };
    expect(body.accessToken).toBeTruthy();
    expect(body.expiresInSec).toBe(15 * 60);
    expect(res.setCookie.some((c) => c.startsWith("dh_refresh="))).toBe(true);
  });
});

describe("POST /auth/logout", () => {
  it("returns ok without a refresh cookie", async () => {
    const res = await request("POST", "/auth/logout");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
  });

  it("revokes refresh token from cookie", async () => {
    const rawRefresh = "logout-refresh-token";
    const res = await request("POST", "/auth/logout", {
      cookie: `dh_refresh=${rawRefresh}`,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("POST /auth/ws-ticket", () => {
  it("returns 503 when JWT_SECRET is not configured", async () => {
    delete process.env.JWT_SECRET;
    const res = await request("POST", "/auth/ws-ticket", {
      body: { role: "host", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(503);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/auth/ws-ticket", {
      body: { role: "host", sessionId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 for host role without authentication", async () => {
    const res = await request("POST", "/auth/ws-ticket", {
      body: { role: "host", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session is missing (host)", async () => {
    queueResults([{ id: HOST_ID, hostToken: HOST_TOKEN }], []);
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { role: "host", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Session not found" });
  });

  it("returns 403 when host does not own the session", async () => {
    queueResults(
      [{ id: HOST_ID, hostToken: HOST_TOKEN }],
      [{ id: SESSION_ID, hostId: "other-host", claimedByPlayerId: null }],
    );
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { role: "host", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "Not your session" });
  });

  it("returns ws ticket for authenticated host", async () => {
    queueResults(
      [{ id: HOST_ID, hostToken: HOST_TOKEN }],
      [{ id: SESSION_ID, hostId: HOST_ID, claimedByPlayerId: null }],
    );
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { role: "host", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(200);
    const body = res.json as { wsTicket: string; expiresInSec: number };
    expect(body.wsTicket).toBeTruthy();
    expect(body.expiresInSec).toBe(5 * 60);
  });

  it("returns 401 for player role without wallet token", async () => {
    const res = await request("POST", "/auth/ws-ticket", {
      body: { role: "player", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "X-Player-Wallet-Token required" });
  });

  it("returns 401 for invalid player wallet token", async () => {
    queueResults([]);
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { "X-Player-Wallet-Token": "bad-token" },
      body: { role: "player", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid player wallet token" });
  });

  it("returns 403 when session is not claimed by player", async () => {
    queueResults(
      [{ id: PLAYER_ID }],
      [{ id: SESSION_ID, hostId: HOST_ID, claimedByPlayerId: "other-player" }],
    );
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
      body: { role: "player", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "Session not claimed by this player" });
  });

  it("returns ws ticket for authenticated player", async () => {
    queueResults(
      [{ id: PLAYER_ID }],
      [{ id: SESSION_ID, hostId: HOST_ID, claimedByPlayerId: PLAYER_ID }],
    );
    const res = await request("POST", "/auth/ws-ticket", {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
      body: { role: "player", sessionId: SESSION_ID },
    });
    expect(res.status).toBe(200);
    const body = res.json as { wsTicket: string; expiresInSec: number };
    expect(body.wsTicket).toBeTruthy();
    expect(body.expiresInSec).toBe(5 * 60);
  });
});
