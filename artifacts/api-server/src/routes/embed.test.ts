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

const API_KEY = "test-embed-api-key";
const GAME_SLUG = "test-game";

const DEV_KEY = {
  id: "dk-1",
  apiKey: API_KEY,
  status: "active",
  hostRulesJson: {},
  internalBalanceLzt: 1000,
  withdrawableBalanceLzt: 500,
};

const GAME = {
  id: "game-1",
  slug: GAME_SLUG,
  title: "Test Game",
};

const HOST = {
  id: "host-1",
  displayName: "Test Host",
  scheduleMode: "always",
  scheduleJson: [],
  tags: [] as string[],
  pcSpecs: null,
};

const HOST_GAME_ENTRY = {
  gameId: "game-1",
  hostId: "host-1",
  enabled: true,
  pricePerMinuteLzt: 10,
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
  const chain = {
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
      where: vi.fn(async () => nextResult()),
      innerJoin: vi.fn(() => innerJoinChain),
    })),
  };
}

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: vi.fn(async () => undefined),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      execute: vi.fn(async () => undefined),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [
            {
              id: "session-1",
              hostId: HOST.id,
              gameId: GAME.id,
            },
          ]),
        })),
      })),
    };
    return fn(tx);
  }),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  devKeysTable: {
    id: "id",
    apiKey: "apiKey",
    status: "status",
    hostRulesJson: "hostRulesJson",
    internalBalanceLzt: "internalBalanceLzt",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
  },
  gamesTable: {
    id: "id",
    slug: "slug",
    title: "title",
  },
  hostsTable: {
    id: "id",
    displayName: "displayName",
    scheduleMode: "scheduleMode",
    scheduleJson: "scheduleJson",
    tags: "tags",
    pcSpecs: "pcSpecs",
  },
  hostGamesTable: {
    gameId: "gameId",
    hostId: "hostId",
    enabled: "enabled",
    pricePerMinuteLzt: "pricePerMinuteLzt",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    status: "status",
  },
  quotasTable: {
    id: "id",
    devKeyId: "devKeyId",
    status: "status",
    startAt: "startAt",
    endAt: "endAt",
    kind: "kind",
    escrowRemainingLzt: "escrowRemainingLzt",
  },
  quotaSessionsTable: {
    quotaId: "quotaId",
    sessionId: "sessionId",
  },
}));

vi.mock("../lib/tokens", () => ({
  generateToken: vi.fn(() => "embed-player-token"),
}));

vi.mock("../lib/invites", () => ({
  generateInviteCode: vi.fn(() => "INVITE01"),
  defaultInviteExpiresAt: vi.fn(() => new Date("2030-01-01T00:00:00.000Z")),
}));

const { default: embedRouter } = await import("./embed");

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: { body?: unknown; ip?: string } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.ip ? { "X-Forwarded-For": opts.ip } : {}),
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
  app.use(embedRouter);
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

describe("POST /embed/sessions", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/embed/sessions", { body: {} });
    expect(res.status).toBe(400);
  });

  it("returns 403 for unknown API key", async () => {
    queueResults([]);
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: "missing-key", gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "invalid_api_key" });
  });

  it("returns 403 when API key is disabled", async () => {
    queueResults([{ ...DEV_KEY, status: "revoked" }]);
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ error: "key_disabled" });
  });

  it("returns 404 when game slug is unknown", async () => {
    queueResults([DEV_KEY], []);
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: "missing-game" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "game_not_found" });
  });

  it("returns 404 when no eligible host matches rules", async () => {
    queueResults([DEV_KEY], [GAME], []);
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "no_eligible_host" });
  });

  it("returns 402 when dev key balance is below one minute rate", async () => {
    queueResults(
      [{ ...DEV_KEY, internalBalanceLzt: 5, withdrawableBalanceLzt: 0 }],
      [GAME],
      [{ entry: { ...HOST_GAME_ENTRY, pricePerMinuteLzt: 100 }, host: HOST }],
      [],
    );
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(402);
    expect(res.json).toMatchObject({
      error: "key_balance_exhausted",
      balanceLzt: 5,
      requiredLzt: 100,
    });
  });

  it("returns 409 when linked quota requirements are not met by any host", async () => {
    const linkedQuota = {
      id: "quota-1",
      devKeyId: DEV_KEY.id,
      status: "active",
      gameId: "other-game-id",
      startAt: null,
      endAt: null,
      kind: "standard",
      escrowRemainingLzt: null,
    };
    queueResults(
      [DEV_KEY],
      [GAME],
      [{ entry: HOST_GAME_ENTRY, host: HOST }],
      [linkedQuota],
    );
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ error: "quota_requirements_unmet" });
  });

  it("returns 409 when all eligible hosts are busy", async () => {
    queueResults(
      [DEV_KEY],
      [GAME],
      [{ entry: HOST_GAME_ENTRY, host: HOST }],
      [],
    );
    mockDb.transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        execute: vi.fn(async () => undefined),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: "busy-session" }]),
            })),
          })),
        })),
        insert: vi.fn(),
      };
      return fn(tx);
    });
    const res = await request("POST", "/embed/sessions", {
      body: { apiKey: API_KEY, gameSlug: GAME_SLUG },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ error: "hosts_busy" });
  });

  it("creates an embed session on the cheapest eligible host", async () => {
    queueResults(
      [DEV_KEY],
      [GAME],
      [{ entry: HOST_GAME_ENTRY, host: HOST }],
      [],
    );
    const res = await request("POST", "/embed/sessions", {
      body: {
        apiKey: API_KEY,
        gameSlug: GAME_SLUG,
        resolution: "1280x720",
        bitrateKbps: 4000,
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({
      sessionId: "session-1",
      playerToken: "embed-player-token",
      gameSlug: GAME_SLUG,
      gameTitle: GAME.title,
      hostDisplayName: HOST.displayName,
      ratePerMinuteLzt: HOST_GAME_ENTRY.pricePerMinuteLzt,
      keyBalanceLzt: DEV_KEY.internalBalanceLzt + DEV_KEY.withdrawableBalanceLzt,
    });
    expect(mockDb.transaction).toHaveBeenCalled();
  });
});
