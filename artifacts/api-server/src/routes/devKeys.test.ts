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
process.env.NODE_ENV = "test";
process.env.DEV_KEYS_CREATE_SECRET = "test-dev-key-secret";

const DEV_KEY_HEADERS = {
  "X-Dev-Key-Secret": "test-dev-key-secret",
};

const ADMIN_HOST_TOKEN = "admin-host-token";

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
  const returningFn = vi.fn(async () => nextResult());
  return Object.assign(Promise.resolve(undefined), {
    returning: returningFn,
  });
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  devKeysTable: {
    id: "id",
    apiKey: "apiKey",
    displayName: "displayName",
    status: "status",
    hostRulesJson: "hostRulesJson",
    internalBalanceLzt: "internalBalanceLzt",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    createdAt: "createdAt",
  },
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    isAdmin: "isAdmin",
  },
}));

vi.mock("../lib/walletOwner", () => ({
  ensureDepositAddressesForOwner: vi.fn(async () => [
    {
      currency: "USDT",
      label: "TRC20",
      address: "TTestAddress123",
      network: "TRON",
      minDeposit: "10",
    },
  ]),
}));

const { default: devKeysRouter } = await import("./devKeys");

let baseUrl = "";
let server: Server;

let ipCounter = 0;

async function request(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown; ip?: string } = {},
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
  return `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
}

beforeAll(async () => {
  const app = express();
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(devKeysRouter);
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
  ipCounter += 1;
  vi.clearAllMocks();
  process.env.NODE_ENV = "test";
  process.env.DEV_KEYS_CREATE_SECRET = "test-dev-key-secret";
  delete process.env.ALLOW_OPEN_DEV_KEY_CREATE;
  mockDb.select.mockImplementation(() => chainSelect());
});

describe("POST /dev-keys auth", () => {
  it("returns 401 without credentials when open create is disabled", async () => {
    const res = await request("POST", "/dev-keys", { body: {}, ip: testIp() });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Dev key creation requires"),
    });
  });

  it("returns 401 for invalid dev-key secret", async () => {
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: { "X-Dev-Key-Secret": "wrong-secret" },
      body: {},
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-admin host token", async () => {
    queueResults([{ isAdmin: 0 }]);
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: { Authorization: `Bearer ${ADMIN_HOST_TOKEN}` },
      body: {},
    });
    expect(res.status).toBe(401);
  });

  it("allows creation with admin host token", async () => {
    const created = {
      id: "dk-1",
      apiKey: "lzt_key_test123",
      displayName: "",
      status: "active",
      hostRulesJson: {},
      internalBalanceLzt: 0,
      withdrawableBalanceLzt: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    queueResults([{ isAdmin: 1 }], [created]);
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: { Authorization: `Bearer ${ADMIN_HOST_TOKEN}` },
      body: { displayName: "Partner API" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      apiKey: created.apiKey,
      displayName: created.displayName,
      status: "active",
      depositAddresses: [
        expect.objectContaining({ currency: "USDT", address: "TTestAddress123" }),
      ],
    });
  });

  it("allows creation with X-Dev-Key-Secret", async () => {
    const created = {
      id: "dk-2",
      apiKey: "lzt_key_secret",
      displayName: "Secret mint",
      status: "active",
      hostRulesJson: { tags: ["premium"] },
      internalBalanceLzt: 0,
      withdrawableBalanceLzt: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    queueResults([created]);
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: DEV_KEY_HEADERS,
      body: {
        displayName: "Secret mint",
        hostRules: { tags: ["premium"] },
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      apiKey: created.apiKey,
      hostRules: { tags: ["premium"] },
    });
  });

  it("allows open create in non-production when ALLOW_OPEN_DEV_KEY_CREATE=1", async () => {
    process.env.ALLOW_OPEN_DEV_KEY_CREATE = "1";
    const created = {
      id: "dk-3",
      apiKey: "lzt_key_open",
      displayName: "",
      status: "active",
      hostRulesJson: {},
      internalBalanceLzt: 0,
      withdrawableBalanceLzt: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    queueResults([created]);
    const res = await request("POST", "/dev-keys", { body: {}, ip: testIp() });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ apiKey: created.apiKey });
  });
});

describe("POST /dev-keys validation", () => {
  it("returns 400 for invalid hostRules", async () => {
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: DEV_KEY_HEADERS,
      body: { hostRules: { maxPricePerMinuteLzt: -1 } },
    });
    expect(res.status).toBe(400);
  });

  it("returns 500 when insert returns no row", async () => {
    queueResults([]);
    const res = await request("POST", "/dev-keys", {
      ip: testIp(),
      headers: DEV_KEY_HEADERS,
      body: {},
    });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create API key" });
  });
});

describe("PATCH /dev-keys/:apiKey/rules", () => {
  it("returns 400 for missing apiKey param", async () => {
    const res = await request("PATCH", "/dev-keys//rules", {
      body: { status: "active" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid body", async () => {
    const res = await request("PATCH", "/dev-keys/lzt_key_abc/rules", {
      body: { status: "paused" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when api key is missing", async () => {
    queueResults([]);
    const res = await request("PATCH", "/dev-keys/lzt_key_missing/rules", {
      body: { status: "disabled" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "API key not found" });
  });

  it("updates host rules, status and display name", async () => {
    const existing = {
      id: "dk-1",
      apiKey: "lzt_key_update",
      displayName: "Old",
      status: "active",
      hostRulesJson: {},
    };
    const updated = {
      apiKey: existing.apiKey,
      displayName: "New Name",
      status: "disabled",
      hostRulesJson: { maxPricePerMinuteLzt: 100 },
    };
    queueResults([existing], [updated]);
    const res = await request("PATCH", `/dev-keys/${existing.apiKey}/rules`, {
      body: {
        displayName: "New Name",
        status: "disabled",
        hostRules: { maxPricePerMinuteLzt: 100 },
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      apiKey: updated.apiKey,
      displayName: updated.displayName,
      status: updated.status,
      hostRules: updated.hostRulesJson,
    });
  });
});
