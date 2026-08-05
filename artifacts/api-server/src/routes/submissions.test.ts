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

const HOST_TOKEN = "host-token-123";
const HOST_ID = "host-1";
const SUBMISSION_ID = "sub-1";

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
  return {
    orderBy: orderByResult,
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
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => makeWhere()),
    })),
  })),
};

const mockTryApplyObjectAcl = vi.fn(async () => undefined);

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
  },
  gamesTable: {
    id: "id",
    slug: "slug",
    title: "title",
    steamAppId: "steamAppId",
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
    kind: "kind",
    defaultBrowserUrl: "defaultBrowserUrl",
    steamAppId: "steamAppId",
    pendingHostConfig: "pendingHostConfig",
    createdAt: "createdAt",
  },
}));

vi.mock("../lib/storageRouteHelpers", () => ({
  tryApplyObjectAcl: (...args: unknown[]) => mockTryApplyObjectAcl(...args),
}));

const { default: submissionsRouter } = await import("./submissions");

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
  app.use(submissionsRouter);
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

describe("POST /games/submit", () => {
  const validBody = {
    hostToken: HOST_TOKEN,
    title: "New Game",
    category: "action",
    genres: ["fps"],
    description: "A cool game",
    coverImageUrl: "",
    kind: "native",
    defaultBrowserUrl: "",
  };

  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/games/submit", {
      body: { title: "Missing hostToken" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 for invalid coverImageUrl", async () => {
    const res = await request("POST", "/games/submit", {
      body: { ...validBody, coverImageUrl: "not-a-url" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "coverImageUrl must be a valid http(s) URL or storage path",
    });
  });

  it("returns 400 when browser kind lacks defaultBrowserUrl", async () => {
    const res = await request("POST", "/games/submit", {
      body: { ...validBody, kind: "browser", defaultBrowserUrl: "" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "defaultBrowserUrl is required for browser-kind games",
    });
  });

  it("returns 400 for invalid defaultBrowserUrl", async () => {
    const res = await request("POST", "/games/submit", {
      body: {
        ...validBody,
        kind: "browser",
        defaultBrowserUrl: "not-a-url",
      },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: "defaultBrowserUrl must be a valid http(s) URL",
    });
  });

  it("returns 401 for unknown hostToken", async () => {
    queueResults([]);
    const res = await request("POST", "/games/submit", { body: validBody });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown hostToken" });
  });

  it("returns 409 when a matching catalog game already exists", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: "game-1", slug: "new-game", title: "New Game" }],
    );
    const res = await request("POST", "/games/submit", { body: validBody });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("already exists"),
      existingGame: { id: "game-1", slug: "new-game", title: "New Game" },
    });
  });

  it("returns 409 when a matching pending submission already exists", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [],
      [{ id: "sub-existing", title: "New Game", slug: "" }],
    );
    const res = await request("POST", "/games/submit", { body: validBody });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("pending submission"),
      existingSubmission: { id: "sub-existing", title: "New Game" },
    });
  });

  it("returns 429 when host has too many pending submissions", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [],
      [],
      [{ pendingCount: 5 }],
    );
    const res = await request("POST", "/games/submit", { body: validBody });
    expect(res.status).toBe(429);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("5 pending submissions"),
    });
  });

  it("creates a native game submission", async () => {
    const created = {
      id: SUBMISSION_ID,
      hostId: HOST_ID,
      status: "pending",
      title: "New Game",
      slug: "",
      kind: "native",
    };
    queueResults(
      [{ id: HOST_ID }],
      [],
      [],
      [{ pendingCount: 0 }],
      [created],
    );
    const res = await request("POST", "/games/submit", { body: validBody });
    expect(res.status).toBe(201);
    expect(res.json).toEqual(created);
    expect(mockTryApplyObjectAcl).not.toHaveBeenCalled();
  });

  it("creates submission with storage cover path and applies ACL", async () => {
    const created = {
      id: SUBMISSION_ID,
      hostId: HOST_ID,
      status: "pending",
      title: "New Game",
      coverImageUrl: "/objects/covers/cover.png",
    };
    queueResults(
      [{ id: HOST_ID }],
      [],
      [],
      [{ pendingCount: 0 }],
      [created],
    );
    const res = await request("POST", "/games/submit", {
      body: {
        ...validBody,
        coverImageUrl: "/objects/covers/cover.png",
      },
    });
    expect(res.status).toBe(201);
    expect(mockTryApplyObjectAcl).toHaveBeenCalledWith(
      "/objects/covers/cover.png",
      { owner: `host:${HOST_ID}`, visibility: "public" },
      expect.anything(),
    );
  });
});

describe("PATCH /games/submissions/:id/pending-config", () => {
  const configBody = {
    hostToken: HOST_TOKEN,
    pricePerMinuteLzt: 10,
    appPath: "game.exe",
    boundUrl: "",
    launchArgs: "",
  };

  it("returns 400 for invalid body", async () => {
    const res = await request(
      "PATCH",
      `/games/submissions/${SUBMISSION_ID}/pending-config`,
      { body: { hostToken: HOST_TOKEN } },
    );
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 401 for unknown hostToken", async () => {
    queueResults([]);
    const res = await request(
      "PATCH",
      `/games/submissions/${SUBMISSION_ID}/pending-config`,
      { body: configBody },
    );
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown hostToken" });
  });

  it("returns 404 when submission is missing", async () => {
    queueResults([{ id: HOST_ID }], []);
    const res = await request(
      "PATCH",
      `/games/submissions/missing/pending-config`,
      { body: configBody },
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Submission not found" });
  });

  it("returns 403 when submission belongs to another host", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: SUBMISSION_ID, status: "pending", hostId: "other-host" }],
    );
    const res = await request(
      "PATCH",
      `/games/submissions/${SUBMISSION_ID}/pending-config`,
      { body: configBody },
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your submission" });
  });

  it("returns 409 when submission is not pending", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: SUBMISSION_ID, status: "approved", hostId: HOST_ID }],
    );
    const res = await request(
      "PATCH",
      `/games/submissions/${SUBMISSION_ID}/pending-config`,
      { body: configBody },
    );
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: "Submission is already approved" });
  });

  it("saves pending host config", async () => {
    queueResults(
      [{ id: HOST_ID }],
      [{ id: SUBMISSION_ID, status: "pending", hostId: HOST_ID }],
    );
    const res = await request(
      "PATCH",
      `/games/submissions/${SUBMISSION_ID}/pending-config`,
      { body: configBody },
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ saved: true });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("GET /games/submissions/my", () => {
  it("returns 401 when host token is missing", async () => {
    const res = await request("GET", "/games/submissions/my");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Missing X-Host-Token"),
    });
  });

  it("returns 401 for unknown host token", async () => {
    queueResults([]);
    const res = await request("GET", "/games/submissions/my", {
      headers: { "X-Host-Token": "bad-token" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown host token" });
  });

  it("lists submissions for the authenticated host via header", async () => {
    const subs = [
      {
        id: SUBMISSION_ID,
        hostId: HOST_ID,
        title: "New Game",
        status: "pending",
      },
    ];
    queueResults([{ id: HOST_ID }], subs);
    const res = await request("GET", "/games/submissions/my", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual(subs);
  });

  it("accepts hostToken query param", async () => {
    const subs = [{ id: SUBMISSION_ID, title: "Query Game" }];
    queueResults([{ id: HOST_ID }], subs);
    const res = await request(
      "GET",
      `/games/submissions/my?hostToken=${HOST_TOKEN}`,
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual(subs);
  });
});
