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

const HOST_TOKEN = "test-host-token-12345";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhereChain() {
  const limitResult = vi.fn(async () => nextResult());
  const orderByResult = vi.fn(() => ({ limit: limitResult }));
  const chain = {
    orderBy: orderByResult,
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
  return chain;
}

function chainSelect() {
  const orderByResult = vi.fn(() => ({ limit: vi.fn(async () => nextResult()) }));
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      orderBy: orderByResult,
    })),
  };
}

const mockExecute = vi.fn(async () => undefined);
const mockInsertValues = vi.fn(async () => undefined);

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
  execute: mockExecute,
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
  },
  agentEventsTable: {
    id: "id",
    hostId: "hostId",
    level: "level",
    message: "message",
    agentVersion: "agentVersion",
    occurredAt: "occurredAt",
    createdAt: "createdAt",
  },
}));

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false),
}));

const { default: agentTelemetryRouter } = await import("./agentTelemetry");

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
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
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(agentTelemetryRouter);
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
});

describe("POST /agent-telemetry", () => {
  it("returns 401 without host token", async () => {
    const res = await request("POST", "/agent-telemetry", {
      body: {
        events: [{ level: "info", message: "startup" }],
      },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({
      error: "X-Host-Token header required",
    });
  });

  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/agent-telemetry", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { events: [] },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when host is unknown", async () => {
    queueResults([]);
    const res = await request("POST", "/agent-telemetry", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: {
        events: [{ level: "info", message: "agent started" }],
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("stores telemetry events and prunes old rows", async () => {
    queueResults([
      { id: "host-1", displayName: "Test Host" },
    ]);
    const res = await request("POST", "/agent-telemetry", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: {
        agentVersion: "1.2.3",
        events: [
          { level: "info", message: "startup complete" },
          {
            level: "error",
            message: "injector failed",
            occurredAt: "2026-08-05T10:00:00.000Z",
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, stored: 2 });
    expect(mockInsertValues).toHaveBeenCalledOnce();
    expect(mockExecute).toHaveBeenCalledOnce();
  });
});

describe("GET /hosts/:hostToken/agent-events", () => {
  it("returns 400 for short hostToken param", async () => {
    const res = await request("GET", "/hosts/short/agent-events");
    expect(res.status).toBe(400);
  });

  it("returns 404 when host is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}/agent-events`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns recent agent events for the host", async () => {
    const createdAt = new Date("2026-08-05T10:00:00.000Z");
    queueResults(
      [{ id: "host-1" }],
      [
        {
          id: "evt-1",
          level: "info",
          message: "startup",
          agentVersion: "1.0.0",
          occurredAt: null,
          createdAt,
        },
      ],
    );
    const res = await request("GET", `/hosts/${HOST_TOKEN}/agent-events`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        id: "evt-1",
        level: "info",
        message: "startup",
        agentVersion: "1.0.0",
        occurredAt: null,
        createdAt: createdAt.toISOString(),
      },
    ]);
  });
});
