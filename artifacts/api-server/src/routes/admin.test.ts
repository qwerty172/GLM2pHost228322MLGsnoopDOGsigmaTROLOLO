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
process.env.ADMIN_SECRET = "test-admin-secret";

const ADMIN_HEADERS = {
  "X-Admin-Secret": "test-admin-secret",
  "X-Host-Token": "admin-host-token",
};

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function chainSelect() {
  const whereResult = vi.fn(async () => nextResult());
  const orderByResult = vi.fn(async () => nextResult());
  const innerJoinChain = {
    where: vi.fn(() => ({ orderBy: orderByResult })),
  };
  return {
    from: vi.fn(() => ({
      where: whereResult,
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
    values: vi.fn(() => ({
      returning: vi.fn(async () => nextResult()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(async () => undefined),
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
    isAdmin: "isAdmin",
    displayName: "displayName",
    gamesContributed: "gamesContributed",
    lastSubmissionStatus: "lastSubmissionStatus",
    lastSubmissionNote: "lastSubmissionNote",
  },
  gamesTable: {
    id: "id",
    title: "title",
    slug: "slug",
    category: "category",
    genres: "genres",
    description: "description",
    coverImageUrl: "coverImageUrl",
    steamAppId: "steamAppId",
    browserHostUrl: "browserHostUrl",
    hasMods: "hasMods",
    isMultiplayer: "isMultiplayer",
    hostSpectatesPlayer: "hostSpectatesPlayer",
    hasQuests: "hasQuests",
    isHidden: "isHidden",
  },
  gameSubmissionsTable: {
    id: "id",
    hostId: "hostId",
    status: "status",
    title: "title",
    slug: "slug",
    category: "category",
    genres: "genres",
    description: "description",
    coverImageUrl: "coverImageUrl",
    steamAppId: "steamAppId",
    kind: "kind",
    defaultBrowserUrl: "defaultBrowserUrl",
    pendingHostConfig: "pendingHostConfig",
    reviewerId: "reviewerId",
    reviewedAt: "reviewedAt",
    approvedGameId: "approvedGameId",
    rejectionReason: "rejectionReason",
    createdAt: "createdAt",
  },
  hostGamesTable: {},
  sessionsTable: { gameId: "gameId" },
}));

vi.mock("../lib/hostLibrary", () => ({
  addToLibrary: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../lib/storageRouteHelpers", () => ({
  tryApplyObjectAcl: vi.fn(async () => undefined),
}));

const { default: adminRouter } = await import("./admin");

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
  app.use(express.json());
  app.use(adminRouter);
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
  process.env.ADMIN_SECRET = "test-admin-secret";
  mockDb.select.mockImplementation(() => chainSelect());
});

describe("admin routes auth", () => {
  it("returns 503 when ADMIN_SECRET is not configured", async () => {
    delete process.env.ADMIN_SECRET;
    const res = await request("GET", "/admin/games", { headers: ADMIN_HEADERS });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "admin_disabled" });
  });

  it("returns 403 for missing or invalid X-Admin-Secret", async () => {
    const missing = await request("GET", "/admin/games", {
      headers: { "X-Host-Token": ADMIN_HEADERS["X-Host-Token"] },
    });
    expect(missing.status).toBe(403);
    expect(missing.json).toMatchObject({ error: "admin_secret_required" });

    const invalid = await request("GET", "/admin/games", {
      headers: { ...ADMIN_HEADERS, "X-Admin-Secret": "wrong-secret" },
    });
    expect(invalid.status).toBe(403);
  });

  it("returns 401 when X-Host-Token is missing", async () => {
    const res = await request("GET", "/admin/games", {
      headers: { "X-Admin-Secret": ADMIN_HEADERS["X-Admin-Secret"] },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Host-Token header" });
  });

  it("returns 401 for unknown host token", async () => {
    queueResults([]);
    const res = await request("GET", "/admin/games", { headers: ADMIN_HEADERS });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown host token" });
  });

  it("returns 403 when host is not admin", async () => {
    queueResults([{ id: "host-1", isAdmin: false }]);
    const res = await request("GET", "/admin/games", { headers: ADMIN_HEADERS });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Admin access required" });
  });
});

describe("GET /admin/games", () => {
  it("lists all games for an admin host", async () => {
    const games = [{ id: "g1", title: "Test Game", slug: "test-game" }];
    queueResults([{ id: "admin-1", isAdmin: true }], games);
    const res = await request("GET", "/admin/games", { headers: ADMIN_HEADERS });
    expect(res.status).toBe(200);
    expect(res.json).toEqual(games);
  });
});

describe("GET /admin/games/submissions", () => {
  it("rejects invalid status filter", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }]);
    const res = await request(
      "GET",
      "/admin/games/submissions?status=invalid",
      { headers: ADMIN_HEADERS },
    );
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "status must be pending | approved | rejected | all",
    });
  });

  it("returns submissions with submitter display name", async () => {
    queueResults(
      [{ id: "admin-1", isAdmin: true }],
      [
        {
          sub: { id: "sub-1", title: "New Game", status: "pending" },
          submitterName: "Alice",
        },
      ],
    );
    const res = await request("GET", "/admin/games/submissions", {
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      {
        id: "sub-1",
        title: "New Game",
        status: "pending",
        submitterDisplayName: "Alice",
      },
    ]);
  });
});

describe("POST /admin/games/submissions/:id/approve", () => {
  it("returns 404 when submission is missing", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }], []);
    const res = await request(
      "POST",
      "/admin/games/submissions/missing/approve",
      { headers: ADMIN_HEADERS, body: {} },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Submission not found" });
  });

  it("approves a pending submission and creates a catalog game", async () => {
    const sub = {
      id: "sub-1",
      status: "pending",
      title: "Cool Game",
      slug: "cool-game",
      category: "action",
      genres: ["fps"],
      description: "desc",
      coverImageUrl: null,
      steamAppId: null,
      kind: "native",
      defaultBrowserUrl: "",
      hostId: "host-2",
      pendingHostConfig: null,
    };
    const game = { id: "game-1", title: "Cool Game", slug: "cool-game" };
    queueResults(
      [{ id: "admin-1", isAdmin: true }],
      [sub],
      [],
      [game],
    );
    const res = await request(
      "POST",
      "/admin/games/submissions/sub-1/approve",
      { headers: ADMIN_HEADERS, body: {} },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      approved: true,
      game,
      libraryAutoCreated: false,
    });
  });

  it("returns 500 when game insert returns no row", async () => {
    const sub = {
      id: "sub-1",
      status: "pending",
      title: "Cool Game",
      slug: "cool-game",
      category: "action",
      genres: ["fps"],
      description: "desc",
      coverImageUrl: null,
      steamAppId: null,
      kind: "native",
      defaultBrowserUrl: "",
      hostId: "host-2",
      pendingHostConfig: null,
    };
    queueResults(
      [{ id: "admin-1", isAdmin: true }],
      [sub],
      [],
      [],
    );
    const res = await request(
      "POST",
      "/admin/games/submissions/sub-1/approve",
      { headers: ADMIN_HEADERS, body: {} },
    );
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: "Failed to create game" });
  });
});

describe("POST /admin/games/submissions/:id/reject", () => {
  it("requires a rejection reason", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }]);
    const res = await request(
      "POST",
      "/admin/games/submissions/sub-1/reject",
      { headers: ADMIN_HEADERS, body: {} },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when submission is missing", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }], []);
    const res = await request(
      "POST",
      "/admin/games/submissions/missing/reject",
      { headers: ADMIN_HEADERS, body: { reason: "Low quality" } },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Submission not found" });
  });

  it("rejects a pending submission", async () => {
    const sub = {
      id: "sub-1",
      status: "pending",
      title: "Bad Game",
      hostId: "host-2",
    };
    queueResults([{ id: "admin-1", isAdmin: true }], [sub]);
    const res = await request(
      "POST",
      "/admin/games/submissions/sub-1/reject",
      { headers: ADMIN_HEADERS, body: { reason: "Low quality" } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ rejected: true });
  });
});

describe("DELETE /admin/games/:id", () => {
  it("returns 404 when game is missing", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }], []);
    const res = await request("DELETE", "/admin/games/missing", {
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Game not found" });
  });

  it("deletes a game when no sessions reference it", async () => {
    queueResults(
      [{ id: "admin-1", isAdmin: true }],
      [{ id: "game-1", title: "Old Game" }],
      [{ count: 0 }],
    );
    const res = await request("DELETE", "/admin/games/game-1", {
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ deleted: true, id: "game-1" });
  });

  it("blocks deletion when sessions exist", async () => {
    queueResults(
      [{ id: "admin-1", isAdmin: true }],
      [{ id: "game-1", title: "Old Game" }],
      [{ count: 2 }],
    );
    const res = await request("DELETE", "/admin/games/game-1", {
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Cannot delete"),
    });
  });
});

describe("PATCH /admin/games/:id", () => {
  it("returns 404 when game is missing", async () => {
    queueResults([{ id: "admin-1", isAdmin: true }], []);
    const res = await request("PATCH", "/admin/games/missing", {
      headers: ADMIN_HEADERS,
      body: { title: "Updated" },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Game not found" });
  });

  it("updates game metadata", async () => {
    const existing = { id: "game-1", title: "Old", isHidden: false };
    const updated = { ...existing, title: "New Title" };
    queueResults([{ id: "admin-1", isAdmin: true }], [existing], [updated]);
    const res = await request("PATCH", "/admin/games/game-1", {
      headers: ADMIN_HEADERS,
      body: { title: "New Title" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual(updated);
  });
});
