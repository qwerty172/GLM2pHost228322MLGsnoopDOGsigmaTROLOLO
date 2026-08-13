import crypto from "node:crypto";
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

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const PUBKEY_HEX = publicKey.export({ format: "der", type: "spki" }).toString("hex");

function signChallenge(challenge: string): string {
  return crypto
    .sign(null, Buffer.from(challenge, "utf-8"), privateKey)
    .toString("hex");
}

type QueryResult = unknown[];
const queryQueue: QueryResult[] = [];

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
  const orderByResult = vi.fn(async () => nextResult());
  const innerJoinChain = {
    where: vi.fn(() => makeWhereChain()),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      orderBy: orderByResult,
      innerJoin: vi.fn(() => innerJoinChain),
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
    values: vi.fn(async () => undefined),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

let redisStored: string | null = null;
let releaseSetex: (() => void) | null = null;
const setexGate = new Promise<void>((resolve) => {
  releaseSetex = resolve;
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
    agentPubkey: "agentPubkey",
  },
  agentPairingCodesTable: {
    id: "id",
    hostId: "hostId",
    code: "code",
    expiresAt: "expiresAt",
    usedAt: "usedAt",
    agentPubkey: "agentPubkey",
  },
}));

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => ({
    setex: vi.fn(async (_key: string, _ttl: number, val: string) => {
      await setexGate;
      redisStored = val;
    }),
    get: vi.fn(async () => redisStored),
    del: vi.fn(async () => {
      redisStored = null;
      return 1;
    }),
  })),
  isRedisAvailable: vi.fn(() => true),
}));

const { default: agentAuthRouter } = await import("./agentAuth");

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
  app.use(agentAuthRouter);
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
  redisStored = null;
  vi.clearAllMocks();
  mockDb.select.mockImplementation(() => chainSelect());
});

describe("GET /auth/agent-challenge with Redis", () => {
  it("does not respond until setex completes so bind works immediately", async () => {
    const getPromise = request("GET", "/auth/agent-challenge");
    await new Promise((r) => setTimeout(r, 20));
    expect(redisStored).toBeNull();

    releaseSetex?.();
    const getRes = await getPromise;
    expect(getRes.status).toBe(200);
    expect(redisStored).not.toBeNull();

    const challenge = (getRes.json as { challenge: string }).challenge;
    queryQueue.push([{ id: "host-1" }], [{ id: "host-1", agentPubkey: PUBKEY_HEX }]);
    const bindRes = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: "test-host-token",
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(bindRes.status).toBe(200);
  });
});
