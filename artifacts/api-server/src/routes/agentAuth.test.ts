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

const HOST_TOKEN = "test-host-token";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const PUBKEY_HEX = publicKey.export({ format: "der", type: "spki" }).toString("hex");

function signChallenge(challenge: string): string {
  return crypto
    .sign(null, Buffer.from(challenge, "utf-8"), privateKey)
    .toString("hex");
}

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
  getRedis: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false),
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

async function fetchChallenge(): Promise<string> {
  const res = await request("GET", "/auth/agent-challenge");
  expect(res.status).toBe(200);
  const body = res.json as { challenge: string };
  return body.challenge;
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
  vi.clearAllMocks();
  mockDb.select.mockImplementation(() => chainSelect());
});

describe("GET /auth/agent-challenge", () => {
  it("returns a challenge and expiry timestamp", async () => {
    const res = await request("GET", "/auth/agent-challenge");
    expect(res.status).toBe(200);
    const body = res.json as { challenge: string; expiresAt: number };
    expect(body.challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("POST /auth/agent-bind-code", () => {
  it("returns 401 without host authentication", async () => {
    const res = await request("POST", "/auth/agent-bind-code");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: expect.stringContaining("hostToken") });
  });

  it("issues a bind code for an authenticated host", async () => {
    queueResults([
      {
        id: "host-1",
        hostToken: HOST_TOKEN,
        displayName: "Test Host",
        agentPubkey: null,
      },
    ]);
    const res = await request("POST", "/auth/agent-bind-code", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = res.json as { bindCode: string; expiresAt: number };
    expect(body.bindCode).toMatch(/^bind_/);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("POST /auth/bind-agent-key", () => {
  it("rejects body without bindCode or hostToken", async () => {
    const challenge = await fetchChallenge();
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid pubkey hex", async () => {
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: HOST_TOKEN,
        pubkey: "not-hex",
        challenge: "abc",
        signature: "dead",
      },
    });
    expect(res.status).toBe(400);
  });

  it("rejects expired or unknown challenge", async () => {
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: HOST_TOKEN,
        pubkey: PUBKEY_HEX,
        challenge: "unknown-challenge-value",
        signature: signChallenge("unknown-challenge-value"),
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Challenge expired or already used" });
  });

  it("rejects invalid signature", async () => {
    const challenge = await fetchChallenge();
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: HOST_TOKEN,
        pubkey: PUBKEY_HEX,
        challenge,
        signature: "00",
      },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid signature" });
  });

  it("binds pubkey via hostToken", async () => {
    const challenge = await fetchChallenge();
    queueResults([{ id: "host-1" }], [{ id: "host-1", agentPubkey: PUBKEY_HEX }]);
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: HOST_TOKEN,
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
  });

  it("returns 404 when hostToken is unknown", async () => {
    const challenge = await fetchChallenge();
    queueResults([]);
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: "missing-token",
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 409 when a different key is already bound", async () => {
    const challenge = await fetchChallenge();
    queueResults([{ id: "host-1" }], []);
    const res = await request("POST", "/auth/bind-agent-key", {
      body: {
        hostToken: HOST_TOKEN,
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({
      error: "A different key is already bound to this account",
    });
  });
});

describe("POST /auth/agent-login", () => {
  it("rejects invalid body", async () => {
    const res = await request("POST", "/auth/agent-login", {
      body: { pubkey: "bad", challenge: "x", signature: "y" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when no host is bound to the pubkey", async () => {
    const challenge = await fetchChallenge();
    queueResults([]);
    const res = await request("POST", "/auth/agent-login", {
      body: {
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "No host bound to this key" });
  });

  it("returns hostToken for a valid signature", async () => {
    const challenge = await fetchChallenge();
    queueResults([{ id: "host-1", hostToken: HOST_TOKEN }]);
    const res = await request("POST", "/auth/agent-login", {
      body: {
        pubkey: PUBKEY_HEX,
        challenge,
        signature: signChallenge(challenge),
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ hostToken: HOST_TOKEN });
  });
});

describe("POST /auth/agent-pairing-code", () => {
  it("returns 401 without host token header", async () => {
    const res = await request("POST", "/auth/agent-pairing-code");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Host token required" });
  });

  it("generates a six-digit pairing code", async () => {
    queueResults(
      [{ id: "host-1", hostToken: HOST_TOKEN, displayName: "Test Host" }],
      [],
    );
    const res = await request("POST", "/auth/agent-pairing-code", {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    const body = res.json as { code: string; expiresAt: string };
    expect(body.code).toMatch(/^\d{6}$/);
    expect(body.expiresAt).toBeTruthy();
  });
});

describe("GET /auth/agent-pairing-status", () => {
  it("returns expired when no active or recent pairing", async () => {
    queueResults(
      [{ id: "host-1", hostToken: HOST_TOKEN, displayName: "Test Host" }],
      [],
      [],
    );
    const res = await request("GET", "/auth/agent-pairing-status", {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ status: "expired" });
  });

  it("returns pending when an unused code exists", async () => {
    const expiresAt = new Date(Date.now() + 600_000);
    queueResults(
      [{ id: "host-1", hostToken: HOST_TOKEN, displayName: "Test Host" }],
      [],
      [{ expiresAt }],
    );
    const res = await request("GET", "/auth/agent-pairing-status", {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "pending",
      expiresAt: expiresAt.toISOString(),
    });
  });
});

describe("POST /auth/agent-pair", () => {
  it("rejects non-six-digit codes", async () => {
    const res = await request("POST", "/auth/agent-pair", {
      body: { code: "12345" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid pairing code", async () => {
    queueResults([]);
    const res = await request("POST", "/auth/agent-pair", {
      body: { code: "123456" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid or expired pairing code" });
  });

  it("pairs agent and returns host credentials", async () => {
    queueResults(
      [{ hostId: "host-1" }],
      [{ hostToken: HOST_TOKEN, displayName: "Test Host" }],
    );
    const res = await request("POST", "/auth/agent-pair", {
      body: { code: "654321", agentPubkey: PUBKEY_HEX },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      hostToken: HOST_TOKEN,
      displayName: "Test Host",
    });
  });
});
