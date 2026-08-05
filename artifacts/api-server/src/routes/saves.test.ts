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
const PLAYER_TOKEN = "player-wallet-token";
const GAME_ID = "game-1";
const CONTENT_HASH = "a".repeat(64);

const SESSION_ROW = {
  id: SESSION_ID,
  hostId: HOST_ID,
  gameId: GAME_ID,
  claimedByPlayerId: PLAYER_ID,
  isTest: false,
};

const SAVE_ROW = {
  id: "save-1",
  playerId: PLAYER_ID,
  gameId: GAME_ID,
  storageKey: `saves/${PLAYER_ID}/${GAME_ID}/save.zip`,
  objectPath: `/objects/saves/${PLAYER_ID}/${GAME_ID}/save.zip`,
  sizeBytes: 1024,
  version: 1,
  contentHash: CONTENT_HASH,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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
      onConflictDoUpdate: vi.fn(async () => nextResult()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

const {
  mockResolveHostIdFromRequest,
  mockGetSaveFile,
  mockGetSaveDownloadURL,
  mockGetSaveObjectPath,
  mockGetSaveUploadURL,
  mockGetObjectDownloadURL,
  mockGetObjectUploadURLForKey,
} = vi.hoisted(() => ({
  mockResolveHostIdFromRequest: vi.fn(),
  mockGetSaveFile: vi.fn(),
  mockGetSaveDownloadURL: vi.fn(),
  mockGetSaveObjectPath: vi.fn(),
  mockGetSaveUploadURL: vi.fn(),
  mockGetObjectDownloadURL: vi.fn(),
  mockGetObjectUploadURLForKey: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: vi.fn(function () {
    return {
      getSaveFile: mockGetSaveFile,
      getSaveDownloadURL: mockGetSaveDownloadURL,
      getSaveObjectPath: mockGetSaveObjectPath,
      getSaveUploadURL: mockGetSaveUploadURL,
      getObjectDownloadURL: mockGetObjectDownloadURL,
      getObjectUploadURLForKey: mockGetObjectUploadURLForKey,
    };
  }),
  ObjectStorageNotConfiguredError: class ObjectStorageNotConfiguredError extends Error {
    name = "ObjectStorageNotConfiguredError";
  },
}));

vi.mock("../lib/storageRouteHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storageRouteHelpers")>();
  return {
    ...actual,
    resolveHostIdFromRequest: (...args: unknown[]) =>
      mockResolveHostIdFromRequest(...args),
    tryApplyObjectAcl: vi.fn(async () => undefined),
  };
});

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "upload-uuid-1234"),
}));

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
  },
  sessionsTable: {
    id: "id",
    hostId: "hostId",
    gameId: "gameId",
    claimedByPlayerId: "claimedByPlayerId",
    isTest: "isTest",
  },
  gamesTable: {
    id: "id",
    saveManifest: "saveManifest",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
  },
  playerGameSavesTable: {
    id: "id",
    playerId: "playerId",
    gameId: "gameId",
    storageKey: "storageKey",
    objectPath: "objectPath",
    sizeBytes: "sizeBytes",
    version: "version",
    contentHash: "contentHash",
    updatedAt: "updatedAt",
  },
}));

const { default: savesRouter } = await import("./saves");

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
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(savesRouter);
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
      onConflictDoUpdate: vi.fn(async () => nextResult()),
    })),
  }));
  mockDb.update.mockImplementation(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  }));
  mockGetSaveObjectPath.mockImplementation(
    (playerId: string, gameId: string) =>
      `/objects/saves/${playerId}/${gameId}/save.zip`,
  );
});

describe("GET /saves/download-url", () => {
  it("returns 400 for invalid sessionId", async () => {
    const res = await request("GET", "/saves/download-url?sessionId=not-a-uuid", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 when host token is missing", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(null);
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Host-Token header" });
  });

  it("returns 404 when session is not found", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([]);
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
      { headers: { "X-Host-Token": HOST_TOKEN } },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Session not found" });
  });

  it("returns 403 when session belongs to another host", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce("other-host");
    queueResults([SESSION_ROW]);
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
      { headers: { "X-Host-Token": HOST_TOKEN } },
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your session" });
  });

  it("returns 409 when session has no claimed player", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([{ ...SESSION_ROW, claimedByPlayerId: null }]);
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
      { headers: { "X-Host-Token": HOST_TOKEN } },
    );
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: "Session has no claimed player" });
  });

  it("returns 404 when save file is missing", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([SESSION_ROW]);
    mockGetSaveFile.mockResolvedValueOnce(null);
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
      { headers: { "X-Host-Token": HOST_TOKEN } },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "save_not_found" });
  });

  it("returns presigned download URL for a valid session", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([SESSION_ROW]);
    mockGetSaveFile.mockResolvedValueOnce({ sizeBytes: 1024 });
    mockGetSaveDownloadURL.mockResolvedValueOnce("https://storage.example/save.zip");
    const res = await request(
      "GET",
      `/saves/download-url?sessionId=${SESSION_ID}`,
      { headers: { "X-Host-Token": HOST_TOKEN } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      downloadURL: "https://storage.example/save.zip",
      objectPath: `/objects/saves/${PLAYER_ID}/${GAME_ID}/save.zip`,
    });
  });
});

describe("POST /saves/upload-url", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/saves/upload-url", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { sessionId: SESSION_ID, sizeBytes: -1 },
    });
    expect(res.status).toBe(400);
  });

  it("returns presigned upload URL for a valid session", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([SESSION_ROW]);
    mockGetSaveUploadURL.mockResolvedValueOnce("https://storage.example/upload");
    const res = await request("POST", "/saves/upload-url", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { sessionId: SESSION_ID, sizeBytes: 1024 },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      uploadURL: "https://storage.example/upload",
      objectPath: `/objects/saves/${PLAYER_ID}/${GAME_ID}/save.zip`,
    });
  });
});

describe("POST /saves/confirm", () => {
  it("returns 400 for invalid content hash", async () => {
    const res = await request("POST", "/saves/confirm", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: {
        sessionId: SESSION_ID,
        contentHash: "not-a-hash",
        sizeBytes: 1024,
      },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when uploaded save is not found in storage", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([SESSION_ROW]);
    mockGetSaveFile.mockResolvedValueOnce(null);
    const res = await request("POST", "/saves/confirm", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: {
        sessionId: SESSION_ID,
        contentHash: CONTENT_HASH,
        sizeBytes: 1024,
      },
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "save_upload_not_found" });
  });

  it("confirms save metadata after upload", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    queueResults([SESSION_ROW]);
    mockGetSaveFile.mockResolvedValueOnce({ sizeBytes: 1024 });
    const res = await request("POST", "/saves/confirm", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: {
        sessionId: SESSION_ID,
        contentHash: CONTENT_HASH,
        sizeBytes: 1024,
      },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      saved: true,
      objectPath: `/objects/saves/${PLAYER_ID}/${GAME_ID}/save.zip`,
    });
  });
});

describe("GET /players/me/saves/:gameId", () => {
  it("returns 401 without player wallet token", async () => {
    const res = await request("GET", `/players/me/saves/${GAME_ID}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Player-Wallet-Token" });
  });

  it("returns null save when none exists", async () => {
    queueResults([{ id: PLAYER_ID }], []);
    const res = await request("GET", `/players/me/saves/${GAME_ID}`, {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ save: null });
  });

  it("returns save metadata with download URL", async () => {
    queueResults([{ id: PLAYER_ID }], [SAVE_ROW]);
    mockGetObjectDownloadURL.mockResolvedValueOnce(
      "https://storage.example/player-save.zip",
    );
    const res = await request("GET", `/players/me/saves/${GAME_ID}`, {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      save: {
        gameId: GAME_ID,
        version: 1,
        sizeBytes: 1024,
        updatedAt: "2026-01-01T00:00:00.000Z",
        downloadUrl: "https://storage.example/player-save.zip",
      },
    });
  });
});

describe("POST /players/me/saves/:gameId/upload-url", () => {
  it("returns 401 without player wallet token", async () => {
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/upload-url`,
      { body: { sizeBytes: 1024 } },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when game is not found", async () => {
    queueResults([{ id: PLAYER_ID }], []);
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/upload-url`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { sizeBytes: 1024 },
      },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Game not found" });
  });

  it("returns 400 when game has no save manifest", async () => {
    queueResults([{ id: PLAYER_ID }], [{ id: GAME_ID, saveManifest: [] }]);
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/upload-url`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { sizeBytes: 1024 },
      },
    );
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Game has no cloud save manifest" });
  });

  it("returns presigned upload URL for player save", async () => {
    queueResults(
      [{ id: PLAYER_ID }],
      [{ id: GAME_ID, saveManifest: ["saves/profile.dat"] }],
    );
    mockGetObjectUploadURLForKey.mockResolvedValueOnce(
      "https://storage.example/player-upload",
    );
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/upload-url`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { sizeBytes: 2048 },
      },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      uploadURL: "https://storage.example/player-upload",
      storageKey: `saves/${PLAYER_ID}/${GAME_ID}/upload-uuid-1234.zip`,
      sizeBytes: 2048,
    });
  });
});

describe("POST /players/me/saves/:gameId/commit", () => {
  const storageKey = `saves/${PLAYER_ID}/${GAME_ID}/upload-uuid-1234.zip`;

  it("returns 403 for storageKey outside player namespace", async () => {
    queueResults([{ id: PLAYER_ID }]);
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/commit`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { storageKey: "saves/other/game/file.zip", sizeBytes: 1024 },
      },
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Invalid storageKey" });
  });

  it("creates a new save record", async () => {
    const created = {
      ...SAVE_ROW,
      id: "save-new",
      storageKey,
      objectPath: `/objects/${storageKey}`,
      version: 1,
    };
    queueResults([{ id: PLAYER_ID }], [], [created]);
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/commit`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { storageKey, sizeBytes: 1024 },
      },
    );
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      ok: true,
      save: expect.objectContaining({
        id: "save-new",
        storageKey,
        version: 1,
        sizeBytes: 1024,
      }),
    });
  });

  it("updates an existing save record", async () => {
    const updated = {
      ...SAVE_ROW,
      storageKey,
      objectPath: `/objects/${storageKey}`,
      version: 2,
      sizeBytes: 2048,
    };
    queueResults([{ id: PLAYER_ID }], [SAVE_ROW], [updated]);
    const res = await request(
      "POST",
      `/players/me/saves/${GAME_ID}/commit`,
      {
        headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
        body: { storageKey, sizeBytes: 2048 },
      },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      ok: true,
      save: expect.objectContaining({
        storageKey,
        version: 2,
        sizeBytes: 2048,
      }),
    });
  });
});
