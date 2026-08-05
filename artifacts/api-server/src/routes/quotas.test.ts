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

const OWNER_TOKEN = "owner-token";
const HOST_TOKEN = "host-token";
const HOST_ID = "host-1";
const QUOTA_ID = "550e8400-e29b-41d4-a716-446655440001";
const GAME_ID = "game-1";

const QUOTA = {
  id: QUOTA_ID,
  ownerType: "host" as const,
  ownerId: HOST_ID,
  kind: "royalty" as const,
  status: "active" as const,
  title: "Test Quota",
  description: "",
  gameId: null as string | null,
  visibility: "public" as const,
  accessCode: null as string | null,
  devKeyId: null as string | null,
  minSessionMinutes: null as number | null,
  maxSessionMinutes: null as number | null,
  minGpuVram: null as number | null,
  minCpuCores: null as number | null,
  minRamGb: null as number | null,
  minDownloadMbps: null as number | null,
  minUploadMbps: null as number | null,
  recGpuVram: null as number | null,
  recCpuCores: null as number | null,
  recRamGb: null as number | null,
  recDownloadMbps: null as number | null,
  recUploadMbps: null as number | null,
  requiredTier: "min" as const,
  startAt: new Date("2026-01-01T00:00:00.000Z"),
  endAt: null as Date | null,
  budgetLzt: null as number | null,
  escrowRemainingLzt: null as number | null,
  sponsorHostPerMinuteLzt: null as number | null,
  sponsorPlayerPerMinuteLzt: null as number | null,
  royaltyBasis: "percent",
  royaltyValue: 10,
  royaltySource: "player",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const HOST_ROW = {
  id: HOST_ID,
  hostToken: HOST_TOKEN,
  displayName: "Test Host",
  gameId: null,
  pcSpecs: null,
  withdrawableBalanceLzt: 1000,
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
  const orderByResult = vi.fn(() => ({
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  }));
  const chain = {
    orderBy: orderByResult,
    limit: limitResult,
    for: vi.fn(() => ({
      then(
        resolve: (value: QueryResult) => void,
        reject?: (reason: unknown) => void,
      ) {
        return Promise.resolve(nextResult()).then(resolve, reject);
      },
    })),
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
  return chain;
}

function makeFromChain() {
  const innerJoinChain = {
    where: vi.fn(() => makeWhereChain()),
  };
  return {
    where: vi.fn(() => makeWhereChain()),
    orderBy: vi.fn(async () => nextResult()),
    innerJoin: vi.fn(() => innerJoinChain),
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

function chainSelectDistinct() {
  return {
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => makeWhereChain()),
        })),
      })),
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
  selectDistinct: vi.fn(() => chainSelectDistinct()),
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

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const mockIsQuotaActiveNow = vi.fn<(q: typeof QUOTA, now?: Date) => boolean>();
const mockGenerateAccessCode = vi.fn(() => "ABCD1234");
const mockCreditOwnerGreen = vi.fn(async () => undefined);
const mockComputeHostTier = vi.fn(() => "meets_min" as const);
const mockSpecsFromPcSpecs = vi.fn(() => ({
  gpuVram: 8,
  cpuCores: 8,
  ramGb: 16,
  downloadMbps: 100,
  uploadMbps: 20,
}));

const { mockMessagesCreate } = vi.hoisted(() => ({
  mockMessagesCreate: vi.fn(),
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/quotaEngine", () => ({
  generateAccessCode: () => mockGenerateAccessCode(),
  creditOwnerGreen: (...args: unknown[]) => mockCreditOwnerGreen(...args),
  isQuotaActiveNow: (q: typeof QUOTA, now?: Date) =>
    mockIsQuotaActiveNow(q, now),
}));

vi.mock("../lib/hostTier", () => ({
  computeHostTier: () => mockComputeHostTier(),
  specsFromPcSpecs: () => mockSpecsFromPcSpecs(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: mockMessagesCreate,
    };
  },
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  quotasTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    kind: "kind",
    status: "status",
    title: "title",
    description: "description",
    gameId: "gameId",
    visibility: "visibility",
    accessCode: "accessCode",
    devKeyId: "devKeyId",
    minSessionMinutes: "minSessionMinutes",
    maxSessionMinutes: "maxSessionMinutes",
    minGpuVram: "minGpuVram",
    minCpuCores: "minCpuCores",
    minRamGb: "minRamGb",
    minDownloadMbps: "minDownloadMbps",
    minUploadMbps: "minUploadMbps",
    recGpuVram: "recGpuVram",
    recCpuCores: "recCpuCores",
    recRamGb: "recRamGb",
    recDownloadMbps: "recDownloadMbps",
    recUploadMbps: "recUploadMbps",
    requiredTier: "requiredTier",
    startAt: "startAt",
    endAt: "endAt",
    budgetLzt: "budgetLzt",
    escrowRemainingLzt: "escrowRemainingLzt",
    sponsorHostPerMinuteLzt: "sponsorHostPerMinuteLzt",
    sponsorPlayerPerMinuteLzt: "sponsorPlayerPerMinuteLzt",
    royaltyBasis: "royaltyBasis",
    royaltyValue: "royaltyValue",
    royaltySource: "royaltySource",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
    gameId: "gameId",
    pcSpecs: "pcSpecs",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
  },
  playersTable: {
    id: "id",
    displayName: "displayName",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
  },
  gamesTable: {
    id: "id",
    title: "title",
    genre: "genre",
  },
  devKeysTable: {
    id: "id",
    apiKey: "apiKey",
  },
  quotaSessionsTable: {
    quotaId: "quotaId",
    sessionId: "sessionId",
    detachedAt: "detachedAt",
    totalRoyaltyLzt: "totalRoyaltyLzt",
    totalSponsorHostLzt: "totalSponsorHostLzt",
    totalSponsorPlayerLzt: "totalSponsorPlayerLzt",
  },
  billingEventsTable: {
    quotaId: "quotaId",
    billedAt: "billedAt",
    kind: "kind",
    hostCreditLzt: "hostCreditLzt",
    playerDebitLzt: "playerDebitLzt",
    sessionId: "sessionId",
    id: "id",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    claimedByPlayerId: "claimedByPlayerId",
    quotaId: "quotaId",
  },
}));

const { default: quotasRouter } = await import("./quotas");

let baseUrl = "";
let server: Server;

function royaltyCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    ownerToken: OWNER_TOKEN,
    kind: "royalty",
    title: "Royalty Quota",
    visibility: "public",
    royaltyBasis: "percent",
    royaltyValue: 10,
    royaltySource: "player",
    ...overrides,
  };
}

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
  app.use(express.json());
  app.use(quotasRouter);
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
  mockIsQuotaActiveNow.mockReturnValue(true);
  mockDb.select.mockImplementation(() => chainSelect());
  mockDb.selectDistinct.mockImplementation(() => chainSelectDistinct());
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

describe("GET /quotas", () => {
  it("returns public quotas decorated with owner names", async () => {
    queueResults(
      [QUOTA],
      [{ id: HOST_ID, displayName: "Test Host" }],
    );
    const res = await request("GET", "/quotas");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({
        id: QUOTA_ID,
        title: "Test Quota",
        ownerDisplayName: "Test Host",
        accessCode: null,
      }),
    ]);
  });
});

describe("GET /quotas/mine", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("GET", "/quotas/mine");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "ownerToken required" });
  });

  it("returns 404 when owner is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", "/quotas/mine?ownerToken=unknown");
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Owner not found" });
  });

  it("returns owner quotas with access codes", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const privateQuota = {
      ...QUOTA,
      visibility: "private" as const,
      accessCode: "SECRET01",
    };
    queueResults(
      [privateQuota],
      [{ id: HOST_ID, displayName: "Test Host" }],
    );
    const res = await request("GET", `/quotas/mine?ownerToken=${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({
        id: QUOTA_ID,
        accessCode: "SECRET01",
      }),
    ]);
  });
});

describe("GET /quotas/applied", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("GET", "/quotas/applied");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "ownerToken required" });
  });

  it("returns 404 when owner is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", "/quotas/applied?ownerToken=unknown");
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Owner not found" });
  });
});

describe("GET /quotas/match-my-host", () => {
  it("returns 400 when hostToken is missing", async () => {
    const res = await request("GET", "/quotas/match-my-host");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "hostToken required" });
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("GET", "/quotas/match-my-host?hostToken=unknown");
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns matched active quotas for host", async () => {
    queueResults(
      [HOST_ROW],
      [QUOTA],
      [{ id: HOST_ID, displayName: "Test Host" }],
    );
    const res = await request("GET", `/quotas/match-my-host?hostToken=${HOST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({ id: QUOTA_ID, kind: "royalty" }),
    ]);
    expect(mockIsQuotaActiveNow).toHaveBeenCalled();
  });
});

describe("GET /quotas/applicable", () => {
  it("returns 400 when hostToken is missing", async () => {
    const res = await request("GET", "/quotas/applicable");
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "hostToken required" });
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("GET", "/quotas/applicable?hostToken=unknown");
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns applicable quotas filtered by activity", async () => {
    queueResults(
      [HOST_ROW],
      [QUOTA],
      [{ id: HOST_ID, displayName: "Test Host" }],
    );
    const res = await request(
      "GET",
      `/quotas/applicable?hostToken=${HOST_TOKEN}`,
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({ id: QUOTA_ID, accessCode: null }),
    ]);
  });
});

describe("GET /quotas/:id", () => {
  it("returns 404 when quota is not found", async () => {
    queueResults([]);
    const res = await request("GET", `/quotas/${QUOTA_ID}`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Quota not found" });
  });

  it("returns quota detail with stats", async () => {
    queueResults(
      [QUOTA],
      [{ total: 2, active: 1 }],
      [],
      [{ r: 100, sh: 0, sp: 0 }],
      [{ id: HOST_ID, displayName: "Test Host" }],
    );
    const res = await request("GET", `/quotas/${QUOTA_ID}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: QUOTA_ID,
      title: "Test Quota",
      activeSessionCount: 1,
      closedSessionCount: 1,
      totalPaidOutLzt: 100,
      isOwner: false,
      recentMovements: [],
    });
  });
});

describe("POST /quotas", () => {
  it("returns 400 on invalid body", async () => {
    const res = await request("POST", "/quotas", {
      body: { ownerToken: OWNER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 when owner is not found", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/quotas", {
      body: royaltyCreateBody(),
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Owner not found" });
  });

  it("returns 400 when title is empty", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const res = await request("POST", "/quotas", {
      body: royaltyCreateBody({ title: "   " }),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "title required" });
  });

  it("returns 400 for invalid royalty config", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const res = await request("POST", "/quotas", {
      body: royaltyCreateBody({ royaltyBasis: "invalid" }),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "royaltyBasis must be percent or fixed_per_minute",
    });
  });

  it("returns 400 for invalid sponsor config", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const res = await request("POST", "/quotas", {
      body: {
        ownerToken: OWNER_TOKEN,
        kind: "sponsor",
        title: "Sponsor Quota",
        visibility: "public",
        budgetLzt: 0,
        sponsorHostPerMinuteLzt: 0,
        sponsorPlayerPerMinuteLzt: 0,
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "budgetLzt must be a positive integer",
    });
  });

  it("creates a royalty quota and returns 201", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const created = {
      ...QUOTA,
      status: "draft" as const,
      title: "Royalty Quota",
    };
    queueResults([created], [{ id: HOST_ID, displayName: "Test Host" }]);
    const res = await request("POST", "/quotas", {
      body: royaltyCreateBody(),
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      id: QUOTA_ID,
      title: "Royalty Quota",
      status: "draft",
      ownerDisplayName: "Test Host",
    });
  });
});

describe("POST /quotas/ai-suggest-specs", () => {
  it("returns 503 when Anthropic is not configured", async () => {
    const prevUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    const prevKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
    delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    vi.resetModules();
    const { default: freshRouter } = await import("./quotas");
    const app = express();
    app.use(express.json());
    app.use(freshRouter);
    const tmpServer = createServer(app);
    const tmpUrl = await new Promise<string>((resolve) => {
      tmpServer.listen(0, "127.0.0.1", () => {
        const addr = tmpServer.address() as AddressInfo;
        resolve(`http://127.0.0.1:${addr.port}`);
      });
    });
    const res = await fetch(`${tmpUrl}/quotas/ai-suggest-specs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameTitle: "Dota 2" }),
    });
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json).toMatchObject({ error: "ai_unavailable" });
    await new Promise<void>((resolve, reject) => {
      tmpServer.close((err) => (err ? reject(err) : resolve()));
    });
    if (prevUrl) process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL = prevUrl;
    if (prevKey) process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY = prevKey;
  });

  it("returns AI-suggested specs as JSON", async () => {
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ??=
      "https://test.anthropic.example";
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??= "test-api-key";
    mockMessagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"minGpuVram":8,"minCpuCores":6,"minRamGb":16,"minDownloadMbps":50,"minUploadMbps":10,"recGpuVram":12,"recCpuCores":8,"recRamGb":32,"recDownloadMbps":100,"recUploadMbps":20}',
        },
      ],
    });
    const res = await request("POST", "/quotas/ai-suggest-specs", {
      body: { gameTitle: "Dota 2", genre: "MOBA" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      minGpuVram: 8,
      minCpuCores: 6,
      minRamGb: 16,
      recGpuVram: 12,
      recCpuCores: 8,
    });
  });
});

describe("POST /quotas/:id/publish", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("POST", `/quotas/${QUOTA_ID}/publish`, {
      body: {},
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when caller is not owner", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: "other", type: "host" });
    queueResults([{ ...QUOTA, status: "draft" }]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/publish`, {
      body: { ownerToken: OWNER_TOKEN },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "Not your quota" });
  });
});

describe("POST /quotas/:id/regenerate-code", () => {
  it("returns 400 when quota is not private", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([QUOTA]);
    const res = await request(
      "POST",
      `/quotas/${QUOTA_ID}/regenerate-code`,
      { body: { ownerToken: OWNER_TOKEN } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Quota is not private" });
  });

  it("regenerates access code for private quota", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const privateQuota = {
      ...QUOTA,
      visibility: "private" as const,
      accessCode: "OLD12345",
    };
    const updated = { ...privateQuota, accessCode: "ABCD1234" };
    queueResults([privateQuota], [updated], [{ id: HOST_ID, displayName: "Test Host" }]);
    const res = await request(
      "POST",
      `/quotas/${QUOTA_ID}/regenerate-code`,
      { body: { ownerToken: OWNER_TOKEN } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: QUOTA_ID,
      accessCode: "ABCD1234",
    });
    expect(mockGenerateAccessCode).toHaveBeenCalled();
  });
});
