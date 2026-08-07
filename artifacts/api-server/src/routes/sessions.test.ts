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

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const HOST_TOKEN = "host-token-123";
const HOST_ID = "host-1";
const PLAYER_ID = "player-1";
const PLAYER_TOKEN = "player-session-token";
const PLAYER_WALLET_TOKEN = "player-wallet-token";
const GAME_ID = "game-1";
const INVITE_CODE = "INVITE01";

const HOST_ROW = {
  id: HOST_ID,
  hostToken: HOST_TOKEN,
  displayName: "Test Host",
  gameId: GAME_ID,
  minutePriceUsd: "0.05",
  launchPriceUsd: "1.00",
  scheduleMode: "always" as const,
  scheduleJson: [] as Array<{ day: number; startMin: number; endMin: number }>,
  boundUrl: "",
  boundAppLabel: "",
};

const SESSION_ROW = {
  id: SESSION_ID,
  hostId: HOST_ID,
  gameId: GAME_ID,
  playerToken: PLAYER_TOKEN,
  inviteCode: INVITE_CODE,
  inviteExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
  claimedByPlayerId: null as string | null,
  appName: "Test Game",
  status: "pending",
  resolution: "1920x1080",
  bitrateKbps: 6000,
  ratePerMinute: "0.05",
  paymentSource: "auto" as const,
  quotaId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  startedAt: null,
  endedAt: null,
  endReason: null,
  blockMinutes: null,
  blockReservedLzt: null,
  isTest: false,
  devKeyId: null,
};

const PLAYER_ROW = {
  id: PLAYER_ID,
  playerToken: PLAYER_WALLET_TOKEN,
  displayName: "Test Player",
  internalBalanceLzt: 1000,
  withdrawableBalanceLzt: 500,
};

const GAME_ROW = {
  id: GAME_ID,
  slug: "test-game",
  title: "Test Game",
  coverImageUrl: "https://example.com/cover.png",
  browserHostUrl: "https://example.com/play",
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
  const orderByResult = vi.fn(() => ({
    limit: vi.fn(async () => nextResult()),
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  }));
  const limitResult = vi.fn(async () => nextResult());
  return {
    orderBy: orderByResult,
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function chainSelect() {
  const leftJoinHosts = {
    where: vi.fn(() => makeWhereChain()),
  };
  const leftJoinGames = {
    leftJoin: vi.fn(() => leftJoinHosts),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      orderBy: vi.fn(() => ({
        limit: vi.fn(async () => nextResult()),
      })),
      leftJoin: vi.fn(() => leftJoinGames),
    })),
  };
}

function makeWhere() {
  return Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(async () => nextResult()),
  });
}

function makeTx() {
  return {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => nextResult()),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => nextResult()),
      })),
    })),
  };
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
  transaction: vi.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
    fn(makeTx()),
  ),
};

const {
  mockIsHostAvailableNow,
  mockGenerateToken,
  mockIsInviteExpired,
  mockApplyLaunchFee,
  mockPickPlayerBucket,
  mockSubmitSessionRating,
  mockSendSignalingMessage,
} = vi.hoisted(() => ({
  mockIsHostAvailableNow: vi.fn(() => true),
  mockGenerateToken: vi.fn(() => "new-session-token"),
  mockIsInviteExpired: vi.fn(() => false),
  mockApplyLaunchFee: vi.fn(async () => ({ ok: true })),
  mockPickPlayerBucket: vi.fn(() => "green" as const),
  mockSubmitSessionRating: vi.fn(async () => ({
    ok: true,
    ratingAvg: 4.5,
    ratingCount: 10,
  })),
  mockSendSignalingMessage: vi.fn(),
}));

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  ipKey: vi.fn(() => "test-ip"),
}));

vi.mock("../lib/tokens", () => ({
  generateToken: (...args: unknown[]) => mockGenerateToken(...args),
}));

vi.mock("../lib/invites", () => ({
  generateInviteCode: vi.fn(() => INVITE_CODE),
  defaultInviteExpiresAt: vi.fn(() => new Date("2030-01-01T00:00:00.000Z")),
  isInviteExpired: (...args: unknown[]) => mockIsInviteExpired(...args),
}));

vi.mock("../lib/schedule", () => ({
  isHostAvailableNow: (...args: unknown[]) => mockIsHostAvailableNow(...args),
}));

vi.mock("../lib/launchFee", () => ({
  applyLaunchFee: (...args: unknown[]) => mockApplyLaunchFee(...args),
}));

vi.mock("../lib/lzt", () => ({
  pickPlayerBucket: (...args: unknown[]) => mockPickPlayerBucket(...args),
}));

vi.mock("../lib/quotaAttach", () => ({
  checkQuotaAttachment: vi.fn(() => ({ ok: true })),
}));

vi.mock("../lib/quotaEngine", () => ({
  isQuotaActiveNow: vi.fn(() => true),
}));

vi.mock("../lib/sessionBilling", () => ({
  countSessionMinutesUsed: vi.fn(async () => 0),
  refundBlockRemainder: vi.fn(async () => undefined),
}));

vi.mock("../lib/signaling", () => ({
  sendSignalingMessage: (...args: unknown[]) => mockSendSignalingMessage(...args),
  endSessionSignaling: vi.fn(),
}));

vi.mock("../lib/ratings", () => ({
  submitSessionRating: (...args: unknown[]) => mockSubmitSessionRating(...args),
  recordBlockReserveLedger: vi.fn(async () => undefined),
}));

vi.mock("../lib/economy", () => ({
  writeLedger: vi.fn(async () => undefined),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "ledger-group-uuid"),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
    gameId: "gameId",
    minutePriceUsd: "minutePriceUsd",
    launchPriceUsd: "launchPriceUsd",
    scheduleMode: "scheduleMode",
    scheduleJson: "scheduleJson",
    boundUrl: "boundUrl",
    boundAppLabel: "boundAppLabel",
  },
  gamesTable: {
    id: "id",
    slug: "slug",
    title: "title",
    coverImageUrl: "coverImageUrl",
    browserHostUrl: "browserHostUrl",
  },
  hostGamesTable: {
    id: "id",
    hostId: "hostId",
    gameId: "gameId",
    enabled: "enabled",
    pricePerMinuteLzt: "pricePerMinuteLzt",
    sortOrder: "sortOrder",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
    displayName: "displayName",
    internalBalanceLzt: "internalBalanceLzt",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    gameId: "gameId",
    playerToken: "playerToken",
    inviteCode: "inviteCode",
    inviteExpiresAt: "inviteExpiresAt",
    claimedByPlayerId: "claimedByPlayerId",
    appName: "appName",
    status: "status",
    resolution: "resolution",
    bitrateKbps: "bitrateKbps",
    ratePerMinute: "ratePerMinute",
    paymentSource: "paymentSource",
    quotaId: "quotaId",
    createdAt: "createdAt",
    startedAt: "startedAt",
    endedAt: "endedAt",
    endReason: "endReason",
    blockMinutes: "blockMinutes",
    blockReservedLzt: "blockReservedLzt",
    isTest: "isTest",
    devKeyId: "devKeyId",
  },
  quotasTable: {
    id: "id",
    devKeyId: "devKeyId",
    ownerType: "ownerType",
    ownerId: "ownerId",
    visibility: "visibility",
    accessCode: "accessCode",
  },
  quotaSessionsTable: {
    quotaId: "quotaId",
    sessionId: "sessionId",
  },
  sessionMetricsTable: {
    sessionId: "sessionId",
    role: "role",
    sampledAt: "sampledAt",
    rttMs: "rttMs",
    bitrateKbps: "bitrateKbps",
    fps: "fps",
    packetLossPct: "packetLossPct",
    framesDropped: "framesDropped",
    iceCandidateType: "iceCandidateType",
    jitterMs: "jitterMs",
  },
}));

const { default: sessionsRouter } = await import("./sessions");

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
  app.use(sessionsRouter);
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
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
  mockDb.transaction.mockImplementation(
    async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
      fn(makeTx()),
  );
  mockIsHostAvailableNow.mockReturnValue(true);
  mockIsInviteExpired.mockReturnValue(false);
  mockApplyLaunchFee.mockResolvedValue({ ok: true });
  mockPickPlayerBucket.mockReturnValue("green");
});

describe("POST /sessions", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/sessions", { body: {} });
    expect(res.status).toBe(400);
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("POST", "/sessions", {
      body: { hostToken: HOST_TOKEN, appName: "Test" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Host not found" });
  });

  it("returns 409 when host is outside schedule", async () => {
    mockIsHostAvailableNow.mockReturnValueOnce(false);
    queueResults([HOST_ROW]);
    const res = await request("POST", "/sessions", {
      body: { hostToken: HOST_TOKEN, appName: "Test" },
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: "Host is not currently available" });
  });

  it("creates a session for a legacy host", async () => {
    const created = { ...SESSION_ROW, playerToken: "new-session-token" };
    queueResults([HOST_ROW], [], [created]);
    const res = await request("POST", "/sessions", {
      body: { hostToken: HOST_TOKEN, appName: "Test Game" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      hostId: HOST_ID,
      gameId: GAME_ID,
      playerToken: "new-session-token",
      appName: "Test Game",
      ratePerMinute: 0.05,
    });
  });

  it("returns 409 when host already has an active session", async () => {
    queueResults([HOST_ROW], [{ id: "busy-session" }]);
    const res = await request("POST", "/sessions", {
      body: { hostToken: HOST_TOKEN, appName: "Test" },
    });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: "host_busy" });
  });

  it("returns 500 when session transaction yields no row", async () => {
    mockDb.transaction.mockImplementationOnce(async () => undefined);
    queueResults([HOST_ROW]);
    const res = await request("POST", "/sessions", {
      body: { hostToken: HOST_TOKEN, appName: "Test" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create session" });
  });
});

describe("POST /sessions/browser-host", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/sessions/browser-host", { body: {} });
    expect(res.status).toBe(400);
  });

  it("returns 404 when player wallet is not found", async () => {
    queueResults([]);
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: "test-game" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Player wallet not found" });
  });

  it("returns 404 when game is not found", async () => {
    queueResults([PLAYER_ROW], []);
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: "missing" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Game not found" });
  });

  it("returns 400 when game has no browser host URL", async () => {
    queueResults([PLAYER_ROW], [{ ...GAME_ROW, browserHostUrl: null }]);
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: GAME_ROW.slug },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "This game does not support browser-host mode",
    });
  });

  it("creates a browser-host session", async () => {
    const createdHost = { ...HOST_ROW, id: "browser-host-1" };
    const createdSession = { ...SESSION_ROW, hostId: createdHost.id };
    queueResults(
      [PLAYER_ROW],
      [GAME_ROW],
      [createdHost],
      [createdSession],
    );
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: GAME_ROW.slug },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      hostToken: "new-session-token",
      browserHostUrl: GAME_ROW.browserHostUrl,
      session: expect.objectContaining({
        id: SESSION_ID,
        gameId: GAME_ID,
      }),
    });
  });

  it("returns 500 when browser host insert returns empty", async () => {
    queueResults([PLAYER_ROW], [GAME_ROW], []);
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: GAME_ROW.slug },
    });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create browser host" });
  });

  it("returns 500 when browser-host session insert returns empty", async () => {
    const createdHost = { ...HOST_ROW, id: "browser-host-1" };
    queueResults([PLAYER_ROW], [GAME_ROW], [createdHost], []);
    const res = await request("POST", "/sessions/browser-host", {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, gameSlug: GAME_ROW.slug },
    });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create session" });
  });
});

describe("POST /sessions/test", () => {
  it("returns 401 when hostToken is missing", async () => {
    const res = await request("POST", "/sessions/test", { body: {} });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "hostToken required" });
  });

  it("returns 404 when host is not found", async () => {
    queueResults([]);
    const res = await request("POST", "/sessions/test", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Host not found" });
  });

  it("returns 409 when host is busy with a real session", async () => {
    queueResults([HOST_ROW], [], [GAME_ROW], [{ id: "busy-session" }]);
    const res = await request("POST", "/sessions/test", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ error: "host_busy" });
  });

  it("creates a free test session", async () => {
    const testSession = { ...SESSION_ROW, isTest: true };
    queueResults(
      [HOST_ROW],
      [],
      [GAME_ROW],
      [],
      [testSession],
    );
    const res = await request("POST", "/sessions/test", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      session: expect.objectContaining({ id: SESSION_ID, isTest: true }),
      hostBoundUrl: null,
      isExternalUrl: false,
    });
  });

  it("returns 500 when test session insert returns empty", async () => {
    queueResults([HOST_ROW], [], [GAME_ROW], [], []);
    const res = await request("POST", "/sessions/test", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create test session" });
  });
});

describe("GET /sessions/by-player-token/:playerToken", () => {
  it("returns 404 when session is not found", async () => {
    queueResults([]);
    const res = await request("GET", `/sessions/by-player-token/${PLAYER_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Session not found" });
  });

  it("returns session with game metadata", async () => {
    queueResults([
      {
        session: SESSION_ROW,
        game: {
          slug: GAME_ROW.slug,
          coverImageUrl: GAME_ROW.coverImageUrl,
          title: GAME_ROW.title,
          browserHostUrl: GAME_ROW.browserHostUrl,
        },
        hostBoundUrl: null,
      },
    ]);
    const res = await request("GET", `/sessions/by-player-token/${PLAYER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      playerToken: PLAYER_TOKEN,
      gameSlug: GAME_ROW.slug,
      gameTitle: GAME_ROW.title,
      gameBrowserHostUrl: GAME_ROW.browserHostUrl,
    });
  });
});

describe("POST /sessions/by-player-token/:playerToken/claim", () => {
  it("returns 404 when session is not found", async () => {
    queueResults([]);
    const res = await request(
      "POST",
      `/sessions/by-player-token/${PLAYER_TOKEN}/claim`,
      { body: { playerWalletToken: PLAYER_WALLET_TOKEN } },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Session not found" });
  });

  it("returns 400 when session has ended", async () => {
    queueResults([{ ...SESSION_ROW, status: "ended" }]);
    const res = await request(
      "POST",
      `/sessions/by-player-token/${PLAYER_TOKEN}/claim`,
      { body: { playerWalletToken: PLAYER_WALLET_TOKEN } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Session has ended" });
  });

  it("returns 400 for embed sessions", async () => {
    queueResults([{ ...SESSION_ROW, devKeyId: "dk-1" }]);
    const res = await request(
      "POST",
      `/sessions/by-player-token/${PLAYER_TOKEN}/claim`,
      { body: { playerWalletToken: PLAYER_WALLET_TOKEN } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "embed_session_not_claimable" });
  });

  it("claims a test session without charging", async () => {
    const claimed = { ...SESSION_ROW, isTest: true, claimedByPlayerId: PLAYER_ID };
    queueResults(
      [{ ...SESSION_ROW, isTest: true }],
      [PLAYER_ROW],
      [HOST_ROW],
      [claimed],
    );
    const res = await request(
      "POST",
      `/sessions/by-player-token/${PLAYER_TOKEN}/claim`,
      { body: { playerWalletToken: PLAYER_WALLET_TOKEN } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      claimedByPlayerId: PLAYER_ID,
    });
    expect(mockApplyLaunchFee).not.toHaveBeenCalled();
  });

  it("returns 400 when player has insufficient balance", async () => {
    mockPickPlayerBucket.mockReturnValueOnce(null);
    queueResults(
      [SESSION_ROW],
      [PLAYER_ROW],
      [HOST_ROW],
    );
    const res = await request(
      "POST",
      `/sessions/by-player-token/${PLAYER_TOKEN}/claim`,
      { body: { playerWalletToken: PLAYER_WALLET_TOKEN } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Insufficient LZT"),
    });
  });
});

describe("GET /sessions/:id", () => {
  it("returns 403 when host token is missing", async () => {
    const res = await request("GET", `/sessions/${SESSION_ID}`);
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Invalid host token" });
  });

  it("returns 404 when session is not found", async () => {
    queueResults([HOST_ROW], []);
    const res = await request("GET", `/sessions/${SESSION_ID}`, {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Session not found" });
  });

  it("returns 403 when session belongs to another host", async () => {
    queueResults([HOST_ROW], [{ ...SESSION_ROW, hostId: "other-host" }]);
    const res = await request("GET", `/sessions/${SESSION_ID}`, {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your session" });
  });

  it("returns session for the owning host", async () => {
    queueResults([HOST_ROW], [SESSION_ROW]);
    const res = await request("GET", `/sessions/${SESSION_ID}`, {
      headers: { "X-User-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      hostId: HOST_ID,
      ratePerMinute: 0.05,
    });
  });
});

describe("PATCH /sessions/:id/end", () => {
  it("returns 403 for invalid host token", async () => {
    queueResults([]);
    const res = await request("PATCH", `/sessions/${SESSION_ID}/end`, {
      body: { hostToken: "wrong-token" },
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Invalid host token" });
  });

  it("ends an active session", async () => {
    const ended = { ...SESSION_ROW, status: "ended", endedAt: new Date() };
    queueResults([HOST_ROW], [SESSION_ROW], [ended]);
    const res = await request("PATCH", `/sessions/${SESSION_ID}/end`, {
      body: { hostToken: HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      status: "ended",
    });
  });
});

describe("GET /sessions/by-invite/:inviteCode", () => {
  it("returns 400 when invite code is empty", async () => {
    const res = await request("GET", "/sessions/by-invite/%20");
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "inviteCode required" });
  });

  it("returns 404 when invite is not found", async () => {
    queueResults([]);
    const res = await request("GET", `/sessions/by-invite/${INVITE_CODE}`);
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Invite not found" });
  });

  it("returns 410 when invite is expired", async () => {
    mockIsInviteExpired.mockReturnValueOnce(true);
    queueResults([SESSION_ROW]);
    const res = await request("GET", `/sessions/by-invite/${INVITE_CODE}`);
    expect(res.status).toBe(410);
    expect(res.json).toMatchObject({ error: "invite_expired" });
  });

  it("returns session for a valid invite", async () => {
    queueResults([SESSION_ROW], [GAME_ROW]);
    const res = await request("GET", `/sessions/by-invite/${INVITE_CODE}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: SESSION_ID,
      inviteCode: INVITE_CODE,
      gameSlug: GAME_ROW.slug,
    });
  });
});

describe("POST /sessions/:id/metrics", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", `/sessions/${SESSION_ID}/metrics`, {
      body: { samples: [] },
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 without host or player token", async () => {
    queueResults([SESSION_ROW]);
    const res = await request("POST", `/sessions/${SESSION_ID}/metrics`, {
      body: {
        samples: [{ role: "player", rttMs: 50 }],
      },
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Forbidden" });
  });

  it("inserts metrics for authorized host", async () => {
    queueResults([SESSION_ROW], [{ id: HOST_ID }]);
    const res = await request("POST", `/sessions/${SESSION_ID}/metrics`, {
      headers: { Authorization: `Bearer ${HOST_TOKEN}` },
      body: {
        samples: [{ role: "host", rttMs: 30, fps: 60 }],
      },
    });
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ inserted: 1 });
  });
});

describe("POST /sessions/:id/rate", () => {
  it("returns 400 when playerWalletToken is missing", async () => {
    const res = await request("POST", `/sessions/${SESSION_ID}/rate`, {
      body: { score: 5 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "playerWalletToken required" });
  });

  it("returns 400 when session is not ended", async () => {
    queueResults([SESSION_ROW]);
    const res = await request("POST", `/sessions/${SESSION_ID}/rate`, {
      body: { playerWalletToken: PLAYER_WALLET_TOKEN, score: 5 },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Session must be ended before rating" });
  });

  it("submits a rating for an ended session", async () => {
    queueResults(
      [{ ...SESSION_ROW, status: "ended", claimedByPlayerId: PLAYER_ID }],
      [PLAYER_ROW],
    );
    const res = await request("POST", `/sessions/${SESSION_ID}/rate`, {
      body: {
        playerWalletToken: PLAYER_WALLET_TOKEN,
        score: 5,
        comment: "Great stream",
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ratingAvg: 4.5, ratingCount: 10 });
    expect(mockSubmitSessionRating).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        playerId: PLAYER_ID,
        score: 5,
        comment: "Great stream",
      }),
    );
  });
});
