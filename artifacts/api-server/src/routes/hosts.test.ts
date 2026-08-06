import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { z } from "zod/v4";
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
const HOST_ID = "host-1";

const scheduleSlotSchema = z.object({
  day: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1440),
});
const scheduleSchema = z.array(scheduleSlotSchema).max(50);

const HOST_ROW = {
  id: HOST_ID,
  hostToken: HOST_TOKEN,
  displayName: "Test Host",
  internalBalanceLzt: 100,
  withdrawableBalanceLzt: 50,
  gameId: null,
  boundAppPath: "",
  boundUrl: "",
  boundAppLabel: "",
  description: "A test host",
  tags: ["fps"],
  launchPriceUsd: "1.00",
  minutePriceUsd: "0.05",
  scheduleMode: "always" as const,
  scheduleJson: [] as Array<{ day: number; startMin: number; endMin: number }>,
  streamPlatform: "obs",
  streamUrl: "",
  streamKey: "",
  creditMinutesPerNewPlayer: 0,
  creditMaxLztPerPlayer: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSubmissionStatus: null,
  lastSubmissionNote: "",
  gamesContributed: 0,
  isAdmin: 0,
  agentPubkey: "",
  pcSpecs: null,
  scheduleAutoDisabledReason: null,
  scheduleAutoDisabledAt: null,
};

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
  const afterOrderBy = {
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
  const chain = {
    orderBy: vi.fn(() => afterOrderBy),
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
  const innerJoinChain = {
    where: vi.fn(() => makeWhereChain()),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      orderBy: vi.fn(async () => nextResult()),
      innerJoin: vi.fn(() => innerJoinChain),
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
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
    internalBalanceLzt: "internalBalanceLzt",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    gameId: "gameId",
    boundAppPath: "boundAppPath",
    boundUrl: "boundUrl",
    boundAppLabel: "boundAppLabel",
    description: "description",
    tags: "tags",
    launchPriceUsd: "launchPriceUsd",
    minutePriceUsd: "minutePriceUsd",
    scheduleMode: "scheduleMode",
    scheduleJson: "scheduleJson",
    streamPlatform: "streamPlatform",
    streamUrl: "streamUrl",
    streamKey: "streamKey",
    creditMinutesPerNewPlayer: "creditMinutesPerNewPlayer",
    creditMaxLztPerPlayer: "creditMaxLztPerPlayer",
    createdAt: "createdAt",
    lastSeenAt: "lastSeenAt",
    lastSubmissionStatus: "lastSubmissionStatus",
    lastSubmissionNote: "lastSubmissionNote",
    gamesContributed: "gamesContributed",
    isAdmin: "isAdmin",
    agentPubkey: "agentPubkey",
    pcSpecs: "pcSpecs",
    scheduleAutoDisabledReason: "scheduleAutoDisabledReason",
    scheduleAutoDisabledAt: "scheduleAutoDisabledAt",
    pingMs: "pingMs",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    status: "status",
    startedAt: "startedAt",
    endedAt: "endedAt",
    createdAt: "createdAt",
    appName: "appName",
    resolution: "resolution",
    bitrateKbps: "bitrateKbps",
    ratePerMinute: "ratePerMinute",
    quotaId: "quotaId",
  },
  withdrawalsTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    requestedAt: "requestedAt",
    completedAt: "completedAt",
    status: "status",
    currency: "currency",
    address: "address",
    amount: "amount",
  },
  gamesTable: { id: "id" },
  scheduleSchema,
  quotasTable: { id: "id", status: "status" },
  quotaSessionsTable: {
    id: "id",
    quotaId: "quotaId",
    sessionId: "sessionId",
    detachedAt: "detachedAt",
  },
  loansTable: {
    id: "id",
    borrowerId: "borrowerId",
    principalLzt: "principalLzt",
    outstandingLzt: "outstandingLzt",
    repaidLzt: "repaidLzt",
    status: "status",
    startedAt: "startedAt",
    dueAt: "dueAt",
    loanType: "loanType",
    lenderType: "lenderType",
    lenderId: "lenderId",
  },
  playersTable: { id: "id", displayName: "displayName" },
}));

vi.mock("../lib/tokens", () => ({
  generateToken: vi.fn(() => "new-host-token"),
}));

vi.mock("../lib/walletOwner", () => ({
  ensureDepositAddressesForOwner: vi.fn(async () => undefined),
}));

vi.mock("../lib/encryption", () => ({
  encryptSecret: vi.fn((s: string) => `enc:${s}`),
  decryptSecret: vi.fn((s: string) => s.replace("enc:", "")),
  isWalletCryptoEnabled: vi.fn(() => false),
}));

vi.mock("../lib/hostLibrary", () => ({
  listLibrary: vi.fn(async () => []),
  addToLibrary: vi.fn(),
  updateEntry: vi.fn(),
  removeFromLibrary: vi.fn(),
}));

vi.mock("../lib/hostTier", () => ({
  generalHostTier: vi.fn(() => "meets_min"),
  computeHostTier: vi.fn(() => "above_rec"),
  specsFromPcSpecs: vi.fn(() => ({})),
  BASELINE_REC: {},
  BASELINE_MIN: {},
}));

vi.mock("../lib/quotaEngine", () => ({
  isQuotaActiveNow: vi.fn(() => true),
}));

vi.mock("../lib/pgNotify", () => ({
  emitPlatformEvent: vi.fn(async () => undefined),
}));

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false),
}));

const { default: hostsRouter } = await import("./hosts");
const { listLibrary } = await import("../lib/hostLibrary");
const { isWalletCryptoEnabled, decryptSecret } = await import("../lib/encryption");
const listLibraryMock = vi.mocked(listLibrary);
const isWalletCryptoEnabledMock = vi.mocked(isWalletCryptoEnabled);
const decryptSecretMock = vi.mocked(decryptSecret);

const QUOTA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_QUOTA_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "sess-attach-1";

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
  app.set("trust proxy", true);
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(hostsRouter);
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
  isWalletCryptoEnabledMock.mockReturnValue(false);
  decryptSecretMock.mockImplementation((s: string) => s.replace("enc:", ""));
  mockDb.select.mockImplementation(() => chainSelect());
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
});

describe("POST /hosts/register", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/hosts/register", { body: {} });
    expect(res.status).toBe(400);
  });

  it("creates a host and returns 201", async () => {
    queueResults([
      {
        ...HOST_ROW,
        hostToken: "new-host-token",
        displayName: "New Host",
        internalBalanceLzt: 0,
        withdrawableBalanceLzt: 0,
      },
    ]);
    const res = await request("POST", "/hosts/register", {
      body: { displayName: "New Host" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      hostToken: "new-host-token",
      displayName: "New Host",
      streamKeySet: false,
      agentKeyBound: false,
      isAdmin: false,
      hostTier: "meets_min",
    });
  });

  it("returns 500 when host insert returns empty", async () => {
    queueResults([]);
    const res = await request("POST", "/hosts/register", {
      body: { displayName: "Fail Host" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Failed to create host" });
  });
});

describe("GET /hosts/:hostToken", () => {
  it("returns 404 when host is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 401 without matching host auth header", async () => {
    queueResults([HOST_ROW]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "host_auth_required" });
  });

  it("returns serialized host profile when header matches path token", async () => {
    queueResults([HOST_ROW]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: HOST_ID,
      hostToken: HOST_TOKEN,
      displayName: HOST_ROW.displayName,
      internalBalanceLzt: 100,
      withdrawableBalanceLzt: 50,
      launchPriceUsd: 1,
      minutePriceUsd: 0.05,
      tags: ["fps"],
      streamKeySet: false,
      agentKeyBound: false,
      isAdmin: false,
    });
  });
});

describe("GET /hosts/me", () => {
  it("returns 401 without host auth", async () => {
    const res = await request("GET", "/hosts/me");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "hostToken required in Authorization or X-Host-Token" });
  });

  it("returns serialized host profile for authenticated host", async () => {
    queueResults([HOST_ROW]);
    const res = await request("GET", "/hosts/me", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      hostToken: HOST_TOKEN,
      internalBalanceLzt: 100,
      withdrawableBalanceLzt: 50,
    });
  });
});

describe("POST /hosts/heartbeat", () => {
  it("returns 401 without hostToken", async () => {
    const res = await request("POST", "/hosts/heartbeat", { body: {} });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "hostToken required" });
  });

  it("returns 404 for unknown host", async () => {
    queueResults([]);
    const res = await request("POST", "/hosts/heartbeat", {
      headers: { "X-Host-Token": "missing" },
      body: { hostToken: "missing" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("updates lastSeenAt and returns ok", async () => {
    queueResults([{ id: HOST_ID }]);
    const res = await request("POST", "/hosts/heartbeat", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { hostToken: HOST_TOKEN, pingMs: 42 },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
  });
});

describe("PATCH /hosts/me/config", () => {
  it("returns 401 without host authentication", async () => {
    const res = await request("PATCH", "/hosts/me/config", {
      body: { description: "updated" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: expect.stringContaining("hostToken") });
  });

  it("returns 400 when price exceeds absolute limit", async () => {
    queueResults([HOST_ROW]);
    const res = await request("PATCH", "/hosts/me/config", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { launchPriceUsd: 999 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("launchPriceUsd"),
    });
  });

  it("updates host config and returns profile", async () => {
    queueResults(
      [HOST_ROW],
      [{ ...HOST_ROW, description: "Updated description" }],
    );
    const res = await request("PATCH", "/hosts/me/config", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { description: "Updated description" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: HOST_ID,
      description: "Updated description",
    });
  });

  it("returns 503 when setting streamKey without encryption", async () => {
    queueResults([HOST_ROW]);
    const res = await request("PATCH", "/hosts/me/config", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { streamKey: "secret-key" },
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "encryption_unavailable" });
  });

  it("returns 500 when config update returns empty", async () => {
    queueResults([HOST_ROW], []);
    const res = await request("PATCH", "/hosts/me/config", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: { description: "will fail" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Failed to update host" });
  });
});

describe("GET /hosts/me/readiness", () => {
  it("returns 401 without host authentication", async () => {
    const res = await request("GET", "/hosts/me/readiness");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: expect.stringContaining("hostToken") });
  });

  it("returns readiness flags for authenticated host", async () => {
    const freshHost = {
      ...HOST_ROW,
      agentPubkey: "pubkey-abc",
      lastSeenAt: new Date(),
    };
    listLibraryMock.mockResolvedValueOnce([
      {
        id: "lib-1",
        hostId: HOST_ID,
        gameId: "game-1",
        pricePerMinuteLzt: 10,
        appPath: "C:\\game.exe",
        boundUrl: "",
        launchArgs: "",
        enabled: true,
        sortOrder: 0,
        localAvailable: true,
        lastError: "",
        addedAt: new Date(),
        hasActiveSession: false,
        game: {
          id: "game-1",
          slug: "test-game",
          title: "Test Game",
          coverImageUrl: "",
          genre: "action",
          browserHostUrl: "",
          hasMods: false,
          isMultiplayer: false,
          steamAppId: null,
        },
      },
    ]);
    queueResults([freshHost], [{ id: "sess-active" }]);
    const res = await request("GET", "/hosts/me/readiness", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      apiOk: true,
      agentKeyBound: true,
      heartbeatFresh: true,
      enabledGamesCount: 1,
      hasActiveSession: true,
      minSupportedAgentVersion: expect.any(String),
    });
  });
});

describe("GET /hosts/:hostToken/stats", () => {
  it("returns 404 when host is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}/stats`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 401 without matching host auth header", async () => {
    queueResults([HOST_ROW]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}/stats`);
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "host_auth_required" });
  });

  it("returns aggregated session stats", async () => {
    const startedAt = new Date("2026-01-01T10:00:00.000Z");
    const endedAt = new Date("2026-01-01T10:30:00.000Z");
    queueResults(
      [HOST_ROW],
      [
        {
          id: "sess-1",
          hostId: HOST_ID,
          status: "ended",
          startedAt,
          endedAt,
        },
        {
          id: "sess-2",
          hostId: HOST_ID,
          status: "active",
          startedAt: new Date("2026-01-01T11:00:00.000Z"),
          endedAt: null,
        },
      ],
    );
    const res = await request("GET", `/hosts/${HOST_TOKEN}/stats`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = res.json as {
      totalSessions: number;
      activeSessions: number;
      totalMinutesStreamed: number;
      internalBalanceLzt: number;
      withdrawableBalanceLzt: number;
    };
    expect(body.totalSessions).toBe(2);
    expect(body.activeSessions).toBe(1);
    expect(body.totalMinutesStreamed).toBeGreaterThanOrEqual(30);
    expect(body.internalBalanceLzt).toBe(100);
    expect(body.withdrawableBalanceLzt).toBe(50);
  });
});

describe("POST /hosts/me/attach-quota", () => {
  it("returns 403 for key-exclusive quota", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: QUOTA_ID, status: "active", devKeyId: "key-1" }],
      [{ id: SESSION_ID, hostId: HOST_ID, status: "active", quotaId: null }],
    );
    const res = await request("POST", "/hosts/me/attach-quota", {
      body: { hostToken: HOST_TOKEN, quotaId: QUOTA_ID },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "quota_key_exclusive" });
  });

  it("returns 409 when session already has a different quota", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: QUOTA_ID, status: "active", devKeyId: null }],
      [
        {
          id: SESSION_ID,
          hostId: HOST_ID,
          status: "active",
          quotaId: OTHER_QUOTA_ID,
        },
      ],
    );
    const res = await request("POST", "/hosts/me/attach-quota", {
      body: { hostToken: HOST_TOKEN, quotaId: QUOTA_ID },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({
      error: "Session already has a different quota attached",
    });
  });
});

describe("GET /hosts/me/stream-relay", () => {
  it("returns 503 when encryption is unavailable", async () => {
    queueResults([
      {
        ...HOST_ROW,
        streamUrl: "rtmp://live.example.com/app",
        streamKey: "enc:secret",
      },
    ]);
    const res = await request("GET", "/hosts/me/stream-relay", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "encryption_unavailable" });
  });

  it("returns 500 when stream key decryption fails", async () => {
    isWalletCryptoEnabledMock.mockReturnValue(true);
    decryptSecretMock.mockImplementation(() => {
      throw new Error("decrypt failed");
    });
    queueResults([
      {
        ...HOST_ROW,
        streamUrl: "rtmp://live.example.com/app",
        streamKey: "enc:bad",
      },
    ]);
    const res = await request("GET", "/hosts/me/stream-relay", {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Failed to decrypt stream key" });
  });
});

describe("GET /hosts/:hostToken/sessions", () => {
  it("returns 404 when host is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}/sessions`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 401 without matching host auth header", async () => {
    queueResults([HOST_ROW]);
    const res = await request("GET", `/hosts/${HOST_TOKEN}/sessions`);
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "host_auth_required" });
  });

  it("returns host sessions with numeric ratePerMinute", async () => {
    queueResults(
      [HOST_ROW],
      [
        {
          id: "sess-1",
          hostId: HOST_ID,
          appName: "Test Game",
          ratePerMinute: "0.05",
          resolution: "1920x1080",
          bitrateKbps: 8000,
          status: "active",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    );
    const res = await request("GET", `/hosts/${HOST_TOKEN}/sessions`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({
        id: "sess-1",
        appName: "Test Game",
        ratePerMinute: 0.05,
        status: "active",
      }),
    ]);
  });
});
