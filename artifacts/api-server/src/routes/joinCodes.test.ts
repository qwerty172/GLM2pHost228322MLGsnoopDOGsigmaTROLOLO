import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
process.env.RATE_LIMIT_STORAGE = "memory";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PLAYER_TOKEN = "player-token-abc";
const JOIN_CODE = "ABC123";

const mockExchangeJoinCode = vi.fn<
  (code: string) => Promise<{ playerToken: string; sessionId: string } | null>
>();

vi.mock("../lib/joinCodes", () => ({
  exchangeJoinCode: (code: string) => mockExchangeJoinCode(code),
}));

const { default: joinCodesRouter } = await import("./joinCodes");

let baseUrl = "";
let server: Server;

async function request(
  code: string,
  opts: { ip?: string } = {},
) {
  const res = await fetch(`${baseUrl}/join-codes/${code}/exchange`, {
    method: "POST",
    headers: opts.ip ? { "X-Forwarded-For": opts.ip } : {},
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
  return {
    status: res.status,
    json,
    headers: res.headers,
  };
}

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(joinCodesRouter);
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
  vi.clearAllMocks();
});

describe("POST /join-codes/:code/exchange", () => {
  it("returns 404 when join code is invalid or expired", async () => {
    mockExchangeJoinCode.mockResolvedValue(null);
    const res = await request(JOIN_CODE);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({
      error: "Join code invalid or expired",
    });
    expect(mockExchangeJoinCode).toHaveBeenCalledWith(JOIN_CODE);
  });

  it("returns playerToken and sessionId for a valid join code", async () => {
    mockExchangeJoinCode.mockResolvedValue({
      playerToken: PLAYER_TOKEN,
      sessionId: SESSION_ID,
    });
    const res = await request(JOIN_CODE);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      playerToken: PLAYER_TOKEN,
      sessionId: SESSION_ID,
    });
    expect(mockExchangeJoinCode).toHaveBeenCalledWith(JOIN_CODE);
  });

  it("sets Deprecation header pointing to invite flow", async () => {
    mockExchangeJoinCode.mockResolvedValue(null);
    const res = await request(JOIN_CODE);
    const deprecation = res.headers.get("deprecation");
    expect(deprecation).toContain("true");
    expect(deprecation).toContain("/api/sessions/by-invite/{inviteCode}");
  });
});
