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
const PLAYER_TOKEN = "player-wallet-token";
const PLAYER_ID = "player-1";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhereChain() {
  return {
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

const mockDb = {
  select: vi.fn(() => chainSelect()),
};

const {
  mockGetObjectEntityUploadURL,
  mockNormalizeObjectEntityPath,
  mockSearchPublicObject,
  mockDownloadObject,
  mockGetObjectEntityFile,
  mockCanAccessObjectEntity,
  mockTrySetObjectEntityAclPolicy,
  mockResolveHostIdFromRequest,
  mockResolveCallerUserId,
  mockGetObjectAclPolicy,
  mockIsCatalogCoverObjectPath,
} = vi.hoisted(() => ({
  mockGetObjectEntityUploadURL: vi.fn(),
  mockNormalizeObjectEntityPath: vi.fn(),
  mockSearchPublicObject: vi.fn(),
  mockDownloadObject: vi.fn(),
  mockGetObjectEntityFile: vi.fn(),
  mockCanAccessObjectEntity: vi.fn(),
  mockTrySetObjectEntityAclPolicy: vi.fn(),
  mockResolveHostIdFromRequest: vi.fn(),
  mockResolveCallerUserId: vi.fn(),
  mockGetObjectAclPolicy: vi.fn(),
  mockIsCatalogCoverObjectPath: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: vi.fn(function () {
    return {
      getObjectEntityUploadURL: mockGetObjectEntityUploadURL,
      normalizeObjectEntityPath: mockNormalizeObjectEntityPath,
      searchPublicObject: mockSearchPublicObject,
      downloadObject: mockDownloadObject,
      getObjectEntityFile: mockGetObjectEntityFile,
      canAccessObjectEntity: mockCanAccessObjectEntity,
      trySetObjectEntityAclPolicy: mockTrySetObjectEntityAclPolicy,
    };
  }),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {
    name = "ObjectNotFoundError";
  },
  ObjectStorageNotConfiguredError: class ObjectStorageNotConfiguredError extends Error {
    name = "ObjectStorageNotConfiguredError";
  },
}));

vi.mock("../lib/objectAcl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/objectAcl")>();
  return {
    ...actual,
    getObjectAclPolicy: (...args: unknown[]) => mockGetObjectAclPolicy(...args),
  };
});

vi.mock("../lib/catalogCoverPaths", () => ({
  isCatalogCoverObjectPath: (...args: unknown[]) =>
    mockIsCatalogCoverObjectPath(...args),
}));

vi.mock("../lib/storageRouteHelpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/storageRouteHelpers")>();
  return {
    ...actual,
    resolveHostIdFromRequest: (...args: unknown[]) =>
      mockResolveHostIdFromRequest(...args),
    resolveCallerUserId: (...args: unknown[]) =>
      mockResolveCallerUserId(...args),
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  hostsTable: {
    id: "id",
    hostToken: "hostToken",
  },
  playersTable: {
    id: "id",
    playerToken: "playerToken",
  },
}));

function makeDownloadResponse(body = "file-bytes") {
  const encoder = new TextEncoder();
  return {
    status: 200,
    headers: new Headers({ "content-type": "image/png" }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

const { default: storageRouter } = await import("./storage");

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    body?: unknown;
    formData?: FormData;
  } = {},
) {
  const headers: Record<string, string> = { ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${baseUrl}${path}`, { method, headers, body });
  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json, text, headers: res.headers };
}

beforeAll(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(express.json());
  app.use(storageRouter);
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
  mockResolveHostIdFromRequest.mockResolvedValue(null);
  mockResolveCallerUserId.mockResolvedValue(undefined);
  mockGetObjectAclPolicy.mockResolvedValue(null);
  mockIsCatalogCoverObjectPath.mockResolvedValue(false);
  mockCanAccessObjectEntity.mockResolvedValue(false);
});

describe("POST /storage/uploads/request-url", () => {
  it("returns 401 when X-Host-Token is missing", async () => {
    const res = await request("POST", "/storage/uploads/request-url", {
      body: { name: "cover.png", size: 1024, contentType: "image/png" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Host-Token header" });
  });

  it("returns 401 for unknown host token", async () => {
    queueResults([]);
    const res = await request("POST", "/storage/uploads/request-url", {
      headers: { "X-Host-Token": "bad-token" },
      body: { name: "cover.png", size: 1024, contentType: "image/png" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown host token" });
  });

  it("returns 400 for invalid upload metadata", async () => {
    queueResults([{ id: HOST_ID }]);
    const res = await request("POST", "/storage/uploads/request-url", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { name: "", size: 0, contentType: "image/gif" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns presigned upload URL for authenticated host", async () => {
    queueResults([{ id: HOST_ID }]);
    mockGetObjectEntityUploadURL.mockResolvedValueOnce(
      "https://storage.example/upload?signed=1",
    );
    mockNormalizeObjectEntityPath.mockReturnValueOnce("/objects/uploads/cover.png");

    const res = await request("POST", "/storage/uploads/request-url", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { name: "cover.png", size: 1024, contentType: "image/png" },
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      uploadURL: "https://storage.example/upload?signed=1",
      objectPath: "/api/storage/objects/uploads/cover.png",
      metadata: { name: "cover.png", size: 1024, contentType: "image/png" },
    });
  });
});

describe("GET /storage/public-objects/*", () => {
  it("returns 404 when public object is not found", async () => {
    mockSearchPublicObject.mockResolvedValueOnce(null);
    const res = await request("GET", "/storage/public-objects/missing.png");
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "File not found" });
  });

  it("streams a found public object", async () => {
    const file = { name: "public/missing.png" };
    mockSearchPublicObject.mockResolvedValueOnce(file);
    mockDownloadObject.mockResolvedValueOnce(makeDownloadResponse("public-data"));

    const res = await request("GET", "/storage/public-objects/missing.png");
    expect(res.status).toBe(200);
    expect(res.text).toBe("public-data");
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});

describe("GET /storage/objects/*", () => {
  const objectFile = { name: "objects/uploads/private.png" };

  it("returns 403 for orphan objects without ACL", async () => {
    mockGetObjectEntityFile.mockResolvedValueOnce(objectFile);
    mockGetObjectAclPolicy.mockResolvedValueOnce(null);
    mockIsCatalogCoverObjectPath.mockResolvedValueOnce(false);

    const res = await request("GET", "/storage/objects/uploads/private.png");
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Forbidden" });
  });

  it("returns 401 when ACL requires auth and caller is anonymous", async () => {
    mockGetObjectEntityFile.mockResolvedValueOnce(objectFile);
    mockGetObjectAclPolicy.mockResolvedValueOnce({
      owner: "host:other",
      visibility: "private",
    });
    mockCanAccessObjectEntity.mockResolvedValueOnce(false);
    mockResolveCallerUserId.mockResolvedValueOnce(undefined);

    const res = await request("GET", "/storage/objects/uploads/private.png");
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unauthorized" });
  });

  it("streams object when caller has ACL access", async () => {
    mockGetObjectEntityFile.mockResolvedValueOnce(objectFile);
    mockGetObjectAclPolicy.mockResolvedValueOnce({
      owner: `host:${HOST_ID}`,
      visibility: "private",
    });
    mockResolveCallerUserId.mockResolvedValueOnce(`host:${HOST_ID}`);
    mockCanAccessObjectEntity.mockResolvedValueOnce(true);
    mockDownloadObject.mockResolvedValueOnce(makeDownloadResponse("private-data"));

    const res = await request("GET", "/storage/objects/uploads/private.png", {
      headers: { "X-Host-Token": HOST_TOKEN },
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe("private-data");
  });
});

describe("POST /storage/uploads/confirm", () => {
  it("returns 401 when host token is missing", async () => {
    const res = await request("POST", "/storage/uploads/confirm", {
      body: { objectPath: "/api/storage/objects/uploads/cover.png" },
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Host-Token header" });
  });

  it("returns 400 for invalid objectPath", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    const res = await request("POST", "/storage/uploads/confirm", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { objectPath: "/rf3-cover.svg" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Invalid objectPath" });
  });

  it("sets public ACL and returns normalized object path", async () => {
    mockResolveHostIdFromRequest.mockResolvedValueOnce(HOST_ID);
    mockTrySetObjectEntityAclPolicy.mockResolvedValueOnce(undefined);

    const res = await request("POST", "/storage/uploads/confirm", {
      headers: { "X-Host-Token": HOST_TOKEN },
      body: { objectPath: "/api/storage/objects/uploads/cover.png" },
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      objectPath: "/api/storage/objects/uploads/cover.png",
    });
    expect(mockTrySetObjectEntityAclPolicy).toHaveBeenCalledWith(
      "/objects/uploads/cover.png",
      { owner: `host:${HOST_ID}`, visibility: "public" },
    );
  });
});

describe("POST /storage/clip-upload", () => {
  it("returns 401 when player wallet token is missing", async () => {
    const res = await request("POST", "/storage/clip-upload");
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Missing X-Player-Wallet-Token header" });
  });

  it("returns 401 for unknown player wallet token", async () => {
    queueResults([]);
    const form = new FormData();
    form.append("file", new Blob(["clip"], { type: "video/webm" }), "clip.webm");

    const res = await request("POST", "/storage/clip-upload", {
      headers: { "X-Player-Wallet-Token": "bad-token" },
      formData: form,
    });
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "Unknown player wallet token" });
  });

  it("returns 400 when no file is uploaded", async () => {
    queueResults([{ id: PLAYER_ID }]);
    const res = await request("POST", "/storage/clip-upload", {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "No file uploaded" });
  });

  it("uploads clip and returns object path", async () => {
    queueResults([{ id: PLAYER_ID }]);
    mockGetObjectEntityUploadURL.mockResolvedValueOnce(
      "https://storage.example/clip-upload?signed=1",
    );
    mockNormalizeObjectEntityPath.mockReturnValueOnce("/objects/clips/clip.webm");
    mockTrySetObjectEntityAclPolicy.mockResolvedValueOnce(undefined);

    const originalFetch = globalThis.fetch;
    const uploadFetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (url, init) => {
        if (typeof url === "string" && url.startsWith("https://storage.example/")) {
          return { ok: true, status: 200 } as Response;
        }
        return originalFetch(url, init);
      },
    );

    const form = new FormData();
    const clipBytes = new Uint8Array([1, 2, 3, 4]);
    form.append("file", new Blob([clipBytes], { type: "video/webm" }), "clip.webm");

    const res = await request("POST", "/storage/clip-upload", {
      headers: { "X-Player-Wallet-Token": PLAYER_TOKEN },
      formData: form,
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      objectPath: "/api/storage/objects/clips/clip.webm",
      size: clipBytes.length,
    });
    expect(uploadFetch).toHaveBeenCalledWith(
      "https://storage.example/clip-upload?signed=1",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "video/webm" },
      }),
    );
    expect(mockTrySetObjectEntityAclPolicy).toHaveBeenCalledWith(
      "/objects/clips/clip.webm",
      { owner: `player:${PLAYER_ID}`, visibility: "private" },
    );

    uploadFetch.mockRestore();
  });
});
