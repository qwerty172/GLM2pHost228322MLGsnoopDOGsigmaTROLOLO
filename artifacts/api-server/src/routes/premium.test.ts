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

const USER_TOKEN = "user-token";
const PLAYER_ID = "player-1";
const HOST_ID = "host-1";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhere() {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(async () => nextResult()),
  });
}

const mockDb = {
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const mockAdjustSystem = vi.fn(async () => undefined);
const mockWriteLedger = vi.fn(async () => undefined);

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    internalBalanceLzt: "internalBalanceLzt",
    premiumUntil: "premiumUntil",
  },
  playersTable: {
    id: "id",
    internalBalanceLzt: "internalBalanceLzt",
    premiumUntil: "premiumUntil",
  },
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/economy", () => ({
  adjustSystem: (...args: unknown[]) => mockAdjustSystem(...args),
  SYSTEM_PLATFORM_FEES: "platform_fees",
  writeLedger: (...args: unknown[]) => mockWriteLedger(...args),
}));

const { default: premiumRouter } = await import("./premium");

let baseUrl = "";
let server: Server;

let ipCounter = 0;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
    ip?: string;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.ip ? { "X-Forwarded-For": opts.ip } : {}),
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
  return { status: res.status, json };
}

function testIp(): string {
  ipCounter += 1;
  return `10.2.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use(premiumRouter);
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
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
});

describe("POST /premium/purchase", () => {
  it("returns 400 when userToken or days missing", async () => {
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "userToken and 1..1825 days required",
    });
  });

  it("returns 400 when days is zero", async () => {
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN, days: 0 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "userToken and 1..1825 days required",
    });
  });

  it("returns 400 when days exceeds maximum", async () => {
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN, days: 365 * 5 + 1 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "userToken and 1..1825 days required",
    });
  });

  it("returns 404 when user is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: "unknown", days: 7 },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "User not found" });
  });

  it("returns 400 when balance is insufficient", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: PLAYER_ID,
      type: "player",
    });
    queueResults([]);
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN, days: 7 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Insufficient balance" });
  });

  it("purchases premium for a player and returns 201", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: PLAYER_ID,
      type: "player",
    });
    const now = new Date();
    queueResults([{ balance: 4200, premiumUntil: null }]);
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN, days: 7 },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      costLzt: 4200,
      premiumUntil: expect.any(String),
    });
    const body = res.json as { premiumUntil: string; costLzt: number };
    const premiumUntil = new Date(body.premiumUntil);
    expect(premiumUntil.getTime()).toBeGreaterThan(now.getTime());
    expect(mockAdjustSystem).toHaveBeenCalledWith(mockDb, "platform_fees", 4200);
    expect(mockWriteLedger).toHaveBeenCalled();
  });

  it("extends premium from existing premiumUntil when still active", async () => {
    mockResolveOwnerByToken.mockResolvedValue({
      id: HOST_ID,
      type: "host",
    });
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    queueResults([{ balance: 1200, premiumUntil: future }]);
    const res = await request("POST", "/premium/purchase", {
      ip: testIp(),
      body: { userToken: USER_TOKEN, days: 2 },
    });
    expect(res.status).toBe(201);
    const body = res.json as { premiumUntil: string; costLzt: number };
    expect(body.costLzt).toBe(1200);
    const premiumUntil = new Date(body.premiumUntil);
    const expected = new Date(future.getTime() + 2 * 24 * 3600 * 1000);
    expect(Math.abs(premiumUntil.getTime() - expected.getTime())).toBeLessThan(
      5000,
    );
  });
});
