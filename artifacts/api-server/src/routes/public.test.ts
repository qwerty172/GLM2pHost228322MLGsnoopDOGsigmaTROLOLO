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

const HOST_ID = "host-1";
const GAME_ID = "game-1";
const GAME_SLUG = "test-game";
const SESSION_ID = "session-1";

const GAME = {
  id: GAME_ID,
  slug: GAME_SLUG,
  title: "Test Game",
  coverImageUrl: "https://example.com/cover.png",
  description: "A test game",
  genre: "action",
  category: "action",
  genres: ["action"],
  steamAppId: null,
  hasMods: false,
  isMultiplayer: true,
  hostSpectatesPlayer: false,
  hasQuests: false,
  browserHostUrl: "",
};

const HOST = {
  id: HOST_ID,
  displayName: "Test Host",
  boundAppLabel: "Test Game",
  boundUrl: "https://stream.example.com/live",
  tags: ["fps"],
  minutePriceUsd: "0.05",
  launchPriceUsd: "1.00",
  scheduleMode: "always" as const,
  scheduleJson: [] as Array<{ day: number; startMin: number; endMin: number }>,
  description: "A test host",
  lastSeenAt: new Date(),
  pingMs: 25,
  pcSpecs: null,
  agentPubkey: "aabbccdd",
};

const SESSION = {
  id: SESSION_ID,
  hostId: HOST_ID,
  appName: "Test Game",
  status: "active",
  inviteCode: "INVITE01",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  gameId: GAME_ID,
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
  const orderByResult = vi.fn(async () => nextResult());
  const limitResult = vi.fn(async () => nextResult());
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

function makeQueryableChain() {
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
  const groupByResult = vi.fn(async () => nextResult());
  const chain = {
    orderBy: orderByResult,
    groupBy: groupByResult,
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
    where: vi.fn(() => makeQueryableChain()),
  };
  return Object.assign(
    {
      where: vi.fn(() => makeQueryableChain()),
      orderBy: vi.fn(async () => nextResult()),
      innerJoin: vi.fn(() => innerJoinChain),
    },
    {
      then(
        resolve: (value: QueryResult) => void,
        reject?: (reason: unknown) => void,
      ) {
        return Promise.resolve(nextResult()).then(resolve, reject);
      },
    },
  );
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
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  ipKey: () => "test-ip",
}));

vi.mock("../lib/signaling", () => ({
  mintPreviewToken: vi.fn((hostId: string) => `preview-${hostId}`),
}));

vi.mock("../lib/invites", () => ({
  generateInviteCode: vi.fn(() => "NEWCODE1"),
  defaultInviteExpiresAt: vi.fn(() => new Date("2030-01-01T00:00:00.000Z")),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  gamesTable: {
    id: "id",
    slug: "slug",
    title: "title",
    coverImageUrl: "coverImageUrl",
    description: "description",
    genre: "genre",
    category: "category",
    genres: "genres",
    steamAppId: "steamAppId",
    hasMods: "hasMods",
    isMultiplayer: "isMultiplayer",
    hostSpectatesPlayer: "hostSpectatesPlayer",
    hasQuests: "hasQuests",
    browserHostUrl: "browserHostUrl",
  },
  hostsTable: {
    id: "id",
    displayName: "displayName",
    boundAppLabel: "boundAppLabel",
    boundUrl: "boundUrl",
    tags: "tags",
    minutePriceUsd: "minutePriceUsd",
    launchPriceUsd: "launchPriceUsd",
    scheduleMode: "scheduleMode",
    scheduleJson: "scheduleJson",
    description: "description",
    lastSeenAt: "lastSeenAt",
    pingMs: "pingMs",
    pcSpecs: "pcSpecs",
    agentPubkey: "agentPubkey",
  },
  hostGamesTable: {
    hostId: "hostId",
    gameId: "gameId",
    enabled: "enabled",
    pricePerMinuteLzt: "pricePerMinuteLzt",
    sortOrder: "sortOrder",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    appName: "appName",
    status: "status",
    inviteCode: "inviteCode",
    createdAt: "createdAt",
    gameId: "gameId",
  },
  billingEventsTable: {
    hostCreditLzt: "hostCreditLzt",
  },
  withdrawalsTable: {
    amount: "amount",
    ownerType: "ownerType",
    status: "status",
  },
}));

const { default: publicRouter } = await import("./public");

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
  app.use(express.json());
  app.use(publicRouter);
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
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
  delete process.env.TURN_URL;
  delete process.env.TURN_USERNAME;
  delete process.env.TURN_CREDENTIAL;
});

describe("GET /public/ping", () => {
  it("returns ok without auth", async () => {
    const res = await request("GET", "/public/ping");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
  });
});

describe("GET /public/agent-requirements", () => {
  it("returns min supported agent version without auth (U-17)", async () => {
    const res = await request("GET", "/public/agent-requirements");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      minSupportedAgentVersion: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
  });
});

describe("GET /public/ice-config", () => {
  it("returns default STUN when TURN env is unset", async () => {
    const res = await request("GET", "/public/ice-config");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
  });

  it("includes TURN when env vars are valid", async () => {
    process.env.TURN_URL = "turn:turn.example.com:3478";
    process.env.TURN_USERNAME = "user";
    process.env.TURN_CREDENTIAL = "secret";
    const res = await request("GET", "/public/ice-config");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:turn.example.com:3478",
          username: "user",
          credential: "secret",
        },
      ],
    });
  });
});

describe("GET /stats", () => {
  it("returns platform stats aggregates", async () => {
    queueResults(
      [{ count: 3 }],
      [{ count: 2 }],
      [{ count: 5 }],
      [{ totalCents: 1200 }],
    );
    const res = await request("GET", "/stats");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      hostsOnline: 3,
      activeSessions: 5,
      totalPaidOutCents: 1200,
    });
  });

  it("falls back to billing accrual when no withdrawals", async () => {
    queueResults(
      [{ count: 0 }],
      [{ count: 1 }],
      [{ count: 1 }],
      [{ totalCents: 0 }],
      [{ accrued: 500 }],
    );
    const res = await request("GET", "/stats");
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      hostsOnline: 1,
      activeSessions: 1,
      totalPaidOutCents: 500,
    });
  });
});

describe("GET /public/games", () => {
  it("returns catalog with live session counts", async () => {
    queueResults([GAME], [{ appName: "Test Game", n: 2 }]);
    const res = await request("GET", "/public/games");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        ...GAME,
        liveSessionCount: 2,
      },
    ]);
  });

  it("filters to liveOnly games", async () => {
    queueResults(
      [
        { ...GAME, id: "game-1", title: "Live Game" },
        { ...GAME, id: "game-2", title: "Quiet Game" },
      ],
      [
        { appName: "Live Game", n: 1 },
        { appName: "Quiet Game", n: 0 },
      ],
    );
    const res = await request("GET", "/public/games?liveOnly=true");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        ...GAME,
        id: "game-1",
        title: "Live Game",
        liveSessionCount: 1,
      },
    ]);
  });
});

describe("GET /hosts", () => {
  it("returns live public hosts with library games", async () => {
    queueResults(
      [{ session: SESSION, host: HOST }],
      [
        {
          hg: {
            hostId: HOST_ID,
            gameId: GAME_ID,
            pricePerMinuteLzt: 10,
          },
          game: {
            id: GAME_ID,
            slug: GAME_SLUG,
            title: GAME.title,
            coverImageUrl: GAME.coverImageUrl,
            genre: GAME.genre,
          },
        },
      ],
    );
    const res = await request("GET", "/hosts");
    expect(res.status).toBe(200);
    const body = res.json as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: HOST_ID,
      displayName: HOST.displayName,
      boundAppLabel: HOST.boundAppLabel,
      boundUrlHost: "stream.example.com",
      inviteCode: SESSION.inviteCode,
      isOnline: true,
      hostTier: "meets_min",
      games: [
        {
          gameId: GAME_ID,
          slug: GAME_SLUG,
          title: GAME.title,
          coverImageUrl: GAME.coverImageUrl,
          genre: GAME.genre,
          pricePerMinuteLzt: 10,
        },
      ],
    });
  });

  it("returns empty list when only browser-host sessions exist (no agentPubkey)", async () => {
    queueResults([]);
    const res = await request("GET", "/hosts");
    expect(res.status).toBe(200);
    expect(res.json).toEqual([]);
  });
});

describe("GET /public/games/:slug/hosts", () => {
  it("returns 404 when game slug is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/public/games/${GAME_SLUG}/hosts`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Game not found" });
  });

  it("returns hosts offering the game", async () => {
    queueResults(
      [{ id: GAME_ID, title: GAME.title }],
      [{ hg: { pricePerMinuteLzt: 10 }, host: HOST }],
      [{ hostId: HOST_ID, inviteCode: SESSION.inviteCode, status: "active" }],
    );
    const res = await request("GET", `/public/games/${GAME_SLUG}/hosts`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        hostId: HOST_ID,
        displayName: HOST.displayName,
        tags: HOST.tags,
        description: HOST.description,
        pricePerMinuteLzt: 10,
        pricePerMinuteUsd: 0.05,
        status: "online",
        inviteCode: SESSION.inviteCode,
        scheduleMode: HOST.scheduleMode,
        pingMs: HOST.pingMs,
        hostTier: "meets_min",
      },
    ]);
  });
});

describe("POST /public/sessions", () => {
  it("returns 400 when hostId is missing", async () => {
    const res = await request("POST", "/public/sessions", { body: {} });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "hostId required" });
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("POST", "/public/sessions", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 404 for browser-host throwaway rows (no agentPubkey)", async () => {
    queueResults([{ id: HOST_ID, agentPubkey: null }]);
    const res = await request("POST", "/public/sessions", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 503 when host has no active session", async () => {
    queueResults([{ id: HOST_ID, agentPubkey: HOST.agentPubkey }], []);
    const res = await request("POST", "/public/sessions", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "host_offline" });
  });

  it("returns 409 when host is online for a different game", async () => {
    queueResults([{ id: HOST_ID, agentPubkey: HOST.agentPubkey }], [], [{ id: SESSION_ID }]);
    const res = await request("POST", "/public/sessions", {
      body: { hostId: HOST_ID, gameId: GAME_ID },
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({
      error: "host_busy",
      reason: "game_unavailable",
    });
  });

  it("returns invite code for an active session", async () => {
    queueResults(
      [{ id: HOST_ID, agentPubkey: HOST.agentPubkey }],
      [{ id: SESSION_ID, inviteCode: SESSION.inviteCode, status: "active" }],
    );
    const res = await request("POST", "/public/sessions", {
      body: { hostId: HOST_ID, gameId: GAME_ID },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      inviteCode: SESSION.inviteCode,
      playPath: `/play/i/${SESSION.inviteCode}`,
    });
  });
});

describe("POST /public/preview-session", () => {
  it("returns 400 when hostId is missing", async () => {
    const res = await request("POST", "/public/preview-session", { body: {} });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "hostId required" });
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("POST", "/public/preview-session", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Host not found" });
  });

  it("returns 503 when host agent is stale", async () => {
    queueResults([
      {
        id: HOST_ID,
        lastSeenAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    ]);
    const res = await request("POST", "/public/preview-session", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "host_offline" });
  });

  it("mints preview token for a recently active host", async () => {
    queueResults([{ id: HOST_ID, lastSeenAt: new Date() }]);
    const res = await request("POST", "/public/preview-session", {
      body: { hostId: HOST_ID },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      previewToken: `preview-${HOST_ID}`,
      hostId: HOST_ID,
    });
  });

  it("returns 429 when preview cooldown is active for the host", async () => {
    const cooldownHostId = "host-preview-cooldown";
    queueResults(
      [{ id: cooldownHostId, lastSeenAt: new Date() }],
      [{ id: cooldownHostId, lastSeenAt: new Date() }],
    );
    const first = await request("POST", "/public/preview-session", {
      body: { hostId: cooldownHostId },
    });
    expect(first.status).toBe(200);

    const res = await request("POST", "/public/preview-session", {
      body: { hostId: cooldownHostId },
    });
    expect(res.status).toBe(429);
    expect(res.json).toMatchObject({
      error: "too_many_requests",
      message: expect.stringContaining("cooldown"),
    });
  });
});
