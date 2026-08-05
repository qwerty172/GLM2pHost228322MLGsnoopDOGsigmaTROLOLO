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
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DISCORD_BOT_TOKEN;
delete process.env.TELEGRAM_WEBHOOK_URL;

const HOST_ID = "host-1";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhereChain() {
  return {
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function makeFromChain() {
  return {
    where: vi.fn(() => makeWhereChain()),
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function chainSelect() {
  return {
    from: vi.fn(() => makeFromChain()),
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

const mockResolveAuthUser = vi.fn<
  (req: unknown) => Promise<{ userId: string; userType: "host" | "player" } | null>
>();

vi.mock("../lib/authMiddleware", () => ({
  resolveAuthUser: (req: unknown) => mockResolveAuthUser(req),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  verifierLinksTable: {
    id: "id",
    userId: "userId",
    userType: "userType",
    provider: "provider",
    providerUserId: "providerUserId",
    providerUsername: "providerUsername",
    active: "active",
  },
  verifierLinkTokensTable: {
    id: "id",
    token: "token",
    userId: "userId",
    userType: "userType",
    provider: "provider",
    expiresAt: "expiresAt",
    consumedAt: "consumedAt",
  },
  verifierChallengesTable: {
    id: "id",
    userId: "userId",
    userType: "userType",
    purpose: "purpose",
    codes: "codes",
    verifiedProviders: "verifiedProviders",
    expiresAt: "expiresAt",
    completedAt: "completedAt",
  },
  playersTable: {
    id: "id",
    trustLevel: "trustLevel",
  },
  hostsTable: {
    id: "id",
    trustLevel: "trustLevel",
  },
}));

const { default: verifierRouter } = await import("./verifier");

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
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

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(verifierRouter);
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
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn(async () => undefined),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
});

describe("GET /verifier/status", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolveAuthUser.mockResolvedValue(null);
    const res = await request("GET", "/verifier/status");
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorized" });
  });

  it("returns linked providers and ready:false when fewer than 2 links", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    queueResults([
      {
        provider: "telegram",
        providerUserId: "tg-1",
        providerUsername: "tg_user",
      },
    ]);
    const res = await request("GET", "/verifier/status");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      linked: [{ provider: "telegram", username: "tg_user" }],
      ready: false,
    });
  });

  it("returns ready:true when at least 2 providers are linked", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    queueResults([
      {
        provider: "telegram",
        providerUserId: "tg-1",
        providerUsername: "tg_user",
      },
      {
        provider: "discord",
        providerUserId: "dc-1",
        providerUsername: "dc_user",
      },
    ]);
    const res = await request("GET", "/verifier/status");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      linked: [
        { provider: "telegram", username: "tg_user" },
        { provider: "discord", username: "dc_user" },
      ],
      ready: true,
    });
  });
});

describe("POST /verifier/link/start", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolveAuthUser.mockResolvedValue(null);
    const res = await request("POST", "/verifier/link/start", {
      body: { provider: "telegram" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid provider", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    const res = await request("POST", "/verifier/link/start", {
      body: { provider: "email" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "provider must be 'telegram' or 'discord'",
    });
  });

  it("returns token and instructions for telegram", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    const res = await request("POST", "/verifier/link/start", {
      body: { provider: "telegram" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      token: expect.stringMatching(/^[A-Z0-9]{6,10}$/),
      expiresIn: expect.any(Number),
      instructions: expect.stringContaining("/link"),
    });
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe("POST /verifier/challenge", () => {
  it("returns 401 when not authenticated", async () => {
    mockResolveAuthUser.mockResolvedValue(null);
    const res = await request("POST", "/verifier/challenge", {
      body: { purpose: "explicit" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorized" });
  });

  it("returns 422 when user has fewer than 2 linked providers", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    queueResults([
      {
        provider: "telegram",
        providerUserId: "tg-1",
        providerUsername: "tg_user",
      },
    ]);
    const res = await request("POST", "/verifier/challenge", {
      body: { purpose: "explicit" },
    });
    expect(res.status).toBe(422);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Need at least 2 linked providers"),
    });
  });
});

describe("POST /verifier/challenge/:id/verify", () => {
  it("returns 400 when provider or code is missing", async () => {
    mockResolveAuthUser.mockResolvedValue({ userId: HOST_ID, userType: "host" });
    const res = await request(
      "POST",
      "/verifier/challenge/550e8400-e29b-41d4-a716-446655440000/verify",
      { body: { provider: "telegram" } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "provider and code are required" });
  });
});

describe("POST /verifier/webhooks/telegram", () => {
  it("always returns 200 ok for webhook payloads", async () => {
    const res = await request("POST", "/verifier/webhooks/telegram", {
      body: { message: { text: "hello", chat: { id: 1 } } },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
  });
});
