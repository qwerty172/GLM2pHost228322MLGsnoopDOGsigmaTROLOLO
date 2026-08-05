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

const PLAYER_TOKEN = "player-token-abc";
const GUEST_TOKEN = "guest-token-xyz";
const HOST_TOKEN = "host-token-123";
const PLAYER_ID = "player-1";
const GUEST_ID = "guest-1";
const HOST_ID = "host-1";

const PLAYER_ROW = {
  id: PLAYER_ID,
  playerToken: PLAYER_TOKEN,
  displayName: "Test Player",
  internalBalanceLzt: 100,
  withdrawableBalanceLzt: 50,
  isGuest: false,
  creditLimitLzt: 3000,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
};

const GUEST_ROW = {
  ...PLAYER_ROW,
  id: GUEST_ID,
  playerToken: GUEST_TOKEN,
  displayName: "Гость_abc123",
  isGuest: true,
  creditLimitLzt: 500,
  internalBalanceLzt: 200,
  withdrawableBalanceLzt: 0,
};

const HOST_ROW = {
  id: HOST_ID,
  hostToken: HOST_TOKEN,
  displayName: "Test Host",
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
  const chain = {
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
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
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
};

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const mockEnsureDepositAddressesForOwner = vi.fn(async () => undefined);

vi.mock("../lib/rateLimit", () => ({
  rateLimit: () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    },
  ipKey: vi.fn(() => "test-ip"),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  playersTable: {
    id: "id",
    playerToken: "playerToken",
    displayName: "displayName",
    internalBalanceLzt: "internalBalanceLzt",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    isGuest: "isGuest",
    creditLimitLzt: "creditLimitLzt",
    createdAt: "createdAt",
    lastSeenAt: "lastSeenAt",
  },
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    displayName: "displayName",
  },
  sessionsTable: {
    id: "id",
    claimedByPlayerId: "claimedByPlayerId",
  },
}));

vi.mock("../lib/tokens", () => ({
  generateToken: vi.fn(() => "new-player-token"),
}));

vi.mock("../lib/walletOwner", () => ({
  ensureDepositAddressesForOwner: (...args: unknown[]) =>
    mockEnsureDepositAddressesForOwner(...args),
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/redis", () => ({
  getRedis: vi.fn(() => null),
  isRedisAvailable: vi.fn(() => false),
}));

const { default: playersRouter } = await import("./players");

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
  app.use(playersRouter);
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
});

describe("POST /players/register", () => {
  it("creates a guest player when guest flag is set", async () => {
    queueResults([
      {
        ...GUEST_ROW,
        playerToken: "new-player-token",
        displayName: "Гость_new-pl",
      },
    ]);
    const res = await request("POST", "/players/register", {
      body: { guest: true },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      playerToken: "new-player-token",
      isGuest: true,
    });
    expect(mockEnsureDepositAddressesForOwner).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid full registration body", async () => {
    const res = await request("POST", "/players/register", {
      body: { displayName: 123 },
    });
    expect(res.status).toBe(400);
  });

  it("creates a full player and provisions deposit addresses", async () => {
    queueResults([
      {
        ...PLAYER_ROW,
        playerToken: "new-player-token",
        displayName: "New Player",
        internalBalanceLzt: 0,
        withdrawableBalanceLzt: 0,
      },
    ]);
    const res = await request("POST", "/players/register", {
      body: { displayName: "New Player" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      playerToken: "new-player-token",
      displayName: "New Player",
      isGuest: false,
    });
    expect(mockEnsureDepositAddressesForOwner).toHaveBeenCalledWith(
      "player",
      PLAYER_ID,
    );
  });

  it("returns 500 when guest insert returns empty", async () => {
    queueResults([]);
    const res = await request("POST", "/players/register", {
      body: { guest: true },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Failed to create guest player" });
  });

  it("returns 500 when full player insert returns empty", async () => {
    queueResults([]);
    const res = await request("POST", "/players/register", {
      body: { displayName: "Fail Player" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Failed to create player" });
  });
});

describe("GET /players/:playerToken", () => {
  it("returns 404 when player is unknown", async () => {
    queueResults([]);
    const res = await request("GET", `/players/${PLAYER_TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Player not found" });
  });

  it("returns serialized player profile", async () => {
    queueResults([PLAYER_ROW]);
    const res = await request("GET", `/players/${PLAYER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: PLAYER_ID,
      playerToken: PLAYER_TOKEN,
      displayName: "Test Player",
      internalBalanceLzt: 100,
      withdrawableBalanceLzt: 50,
      isGuest: false,
    });
  });
});

describe("POST /players/claim-guest", () => {
  it("returns 400 when tokens are missing", async () => {
    const res = await request("POST", "/players/claim-guest", { body: {} });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "guestToken and hostToken are required",
    });
  });

  it("returns 401 for invalid hostToken", async () => {
    queueResults([]);
    const res = await request("POST", "/players/claim-guest", {
      body: { guestToken: GUEST_TOKEN, hostToken: "bad-host" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid hostToken" });
  });

  it("returns 404 when guest is not found", async () => {
    queueResults([HOST_ROW], []);
    const res = await request("POST", "/players/claim-guest", {
      body: { guestToken: GUEST_TOKEN, hostToken: HOST_TOKEN },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({
      error: "Guest player not found or token is not a guest",
    });
  });

  it("transfers guest balance and returns new player token", async () => {
    const fullPlayer = {
      ...PLAYER_ROW,
      id: "full-player-1",
      playerToken: "new-player-token",
      displayName: HOST_ROW.displayName,
      internalBalanceLzt: GUEST_ROW.internalBalanceLzt,
      withdrawableBalanceLzt: GUEST_ROW.withdrawableBalanceLzt,
    };
    queueResults(
      [HOST_ROW],
      [GUEST_ROW],
      [fullPlayer],
      [],
      [],
    );
    const res = await request("POST", "/players/claim-guest", {
      body: { guestToken: GUEST_TOKEN, hostToken: HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      playerToken: "new-player-token",
      transferredInternalLzt: 200,
      transferredWithdrawableLzt: 0,
    });
    expect(mockEnsureDepositAddressesForOwner).toHaveBeenCalledWith(
      "player",
      "full-player-1",
    );
  });

  it("returns 500 when full player insert returns empty", async () => {
    queueResults([HOST_ROW], [GUEST_ROW], []);
    const res = await request("POST", "/players/claim-guest", {
      body: { guestToken: GUEST_TOKEN, hostToken: HOST_TOKEN },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({
      error: "Failed to create full player account",
    });
  });
});

describe("POST /players/upgrade-guest", () => {
  it("returns 400 when guestToken is missing", async () => {
    const res = await request("POST", "/players/upgrade-guest", {
      body: { displayName: "Upgraded" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "guestToken required" });
  });

  it("returns 400 when displayName is too short", async () => {
    const res = await request("POST", "/players/upgrade-guest", {
      body: { guestToken: GUEST_TOKEN, displayName: "A" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "displayName must be 2–32 characters",
    });
  });

  it("returns 404 when guest is unknown", async () => {
    queueResults([]);
    const res = await request("POST", "/players/upgrade-guest", {
      body: { guestToken: GUEST_TOKEN, displayName: "Upgraded" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toMatchObject({ error: "Guest not found" });
  });

  it("returns 400 when account is not a guest", async () => {
    queueResults([PLAYER_ROW]);
    const res = await request("POST", "/players/upgrade-guest", {
      body: { guestToken: PLAYER_TOKEN, displayName: "Upgraded" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: "Account is not a guest" });
  });

  it("upgrades guest to full account", async () => {
    queueResults(
      [GUEST_ROW],
      [
        {
          ...GUEST_ROW,
          playerToken: "new-player-token",
          displayName: "Upgraded",
          isGuest: false,
          creditLimitLzt: 3000,
        },
      ],
    );
    const res = await request("POST", "/players/upgrade-guest", {
      body: { guestToken: GUEST_TOKEN, displayName: "Upgraded" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      playerToken: "new-player-token",
      displayName: "Upgraded",
      isGuest: false,
    });
    expect(mockEnsureDepositAddressesForOwner).toHaveBeenCalledWith(
      "player",
      GUEST_ID,
    );
  });

  it("returns 500 when upgrade update returns empty", async () => {
    queueResults([GUEST_ROW], []);
    const res = await request("POST", "/players/upgrade-guest", {
      body: { guestToken: GUEST_TOKEN, displayName: "Upgraded" },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Upgrade failed" });
  });
});

describe("PATCH /players/me/credit-settings", () => {
  it("returns 401 without X-User-Token", async () => {
    const res = await request("PATCH", "/players/me/credit-settings", {
      body: { creditEnabled: true },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Missing X-User-Token" });
  });

  it("returns 401 for invalid player token", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce(null);
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": "bad-token" },
      body: { creditEnabled: true },
    });
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({ error: "Invalid player token" });
  });

  it("returns 400 for invalid body", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce({
      id: PLAYER_ID,
      type: "player",
    });
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": PLAYER_TOKEN },
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("disables credit limit when creditEnabled is false", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce({
      id: PLAYER_ID,
      type: "player",
    });
    queueResults(
      [PLAYER_ROW],
      [{ ...PLAYER_ROW, creditLimitLzt: 0 }],
    );
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": PLAYER_TOKEN },
      body: { creditEnabled: false },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ creditLimitLzt: 0 });
  });

  it("sets default credit limit for full player when enabled", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce({
      id: PLAYER_ID,
      type: "player",
    });
    queueResults(
      [PLAYER_ROW],
      [{ ...PLAYER_ROW, creditLimitLzt: 3000 }],
    );
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": PLAYER_TOKEN },
      body: { creditEnabled: true },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ creditLimitLzt: 3000 });
  });

  it("sets guest credit limit when enabled for guest account", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce({
      id: GUEST_ID,
      type: "player",
    });
    queueResults(
      [GUEST_ROW],
      [{ ...GUEST_ROW, creditLimitLzt: 500 }],
    );
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": GUEST_TOKEN },
      body: { creditEnabled: true },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ creditLimitLzt: 500 });
  });

  it("returns 500 when credit settings update returns empty", async () => {
    mockResolveOwnerByToken.mockResolvedValueOnce({
      id: PLAYER_ID,
      type: "player",
    });
    queueResults([PLAYER_ROW], []);
    const res = await request("PATCH", "/players/me/credit-settings", {
      headers: { "X-User-Token": PLAYER_TOKEN },
      body: { creditEnabled: true },
    });
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: "Update failed" });
  });
});
