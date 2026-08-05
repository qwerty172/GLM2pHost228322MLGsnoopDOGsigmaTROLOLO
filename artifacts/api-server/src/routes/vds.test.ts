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
const HOST_ID = "host-1";
const QUOTA_ID = "550e8400-e29b-41d4-a716-446655440001";
const VDS_ID = "550e8400-e29b-41d4-a716-446655440002";
const HOST_VDS_ID = "host-vds-1";
const PUBLIC_SSH_HOST = "203.0.113.1";

const QUOTA = {
  id: QUOTA_ID,
  ownerType: "host" as const,
  ownerId: HOST_ID,
  title: "Test Quota",
};

const VDS_ROW = {
  id: VDS_ID,
  quotaId: QUOTA_ID,
  provider: "ssh",
  sshHost: PUBLIC_SSH_HOST,
  sshPort: 22,
  sshUser: "ubuntu",
  sshKeyEncrypted: "encrypted-key",
  status: "pending",
  provisionLog: "",
  lastHealthAt: null as Date | null,
  hostId: null as string | null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const SSH_KEY =
  "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----";

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

function makeFromChain() {
  return {
    where: vi.fn(() => makeWhereChain()),
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
  delete: vi.fn(() => ({
    where: vi.fn(async () => nextResult()),
  })),
};

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

const {
  mockIsWalletCryptoEnabled,
  mockEncryptSshKey,
  mockSshConnect,
} = vi.hoisted(() => ({
  mockIsWalletCryptoEnabled: vi.fn(() => true),
  mockEncryptSshKey: vi.fn((key: string) => `enc:${key}`),
  mockSshConnect: vi.fn(),
}));

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/encryption", () => ({
  isWalletCryptoEnabled: () => mockIsWalletCryptoEnabled(),
}));

vi.mock("../lib/sshKey", () => ({
  encryptSshKey: (key: string) => mockEncryptSshKey(key),
  decryptSshKey: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("ssh2", () => {
  class MockClient {
    on(event: string, cb: (...args: unknown[]) => void) {
      if (event === "ready") {
        queueMicrotask(() => cb());
      }
      if (event === "error") {
        mockSshConnect.mockImplementation(() => {
          queueMicrotask(() => cb(new Error("SSH auth failed")));
        });
      }
      return this;
    }
    connect() {
      mockSshConnect();
      return this;
    }
    end = vi.fn();
    destroy = vi.fn();
  }
  return { Client: MockClient };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  quotasTable: {
    id: "id",
    ownerType: "ownerType",
    ownerId: "ownerId",
    title: "title",
  },
  quotaVdsTable: {
    id: "id",
    quotaId: "quotaId",
    provider: "provider",
    sshHost: "sshHost",
    sshPort: "sshPort",
    sshUser: "sshUser",
    sshKeyEncrypted: "sshKeyEncrypted",
    status: "status",
    provisionLog: "provisionLog",
    lastHealthAt: "lastHealthAt",
    hostId: "hostId",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  hostsTable: {
    id: "id",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    internalBalanceLzt: "internalBalanceLzt",
  },
}));

const { default: vdsRouter } = await import("./vds");

let baseUrl = "";
let server: Server;

function testConnectionBody(overrides: Record<string, unknown> = {}) {
  return {
    ownerToken: OWNER_TOKEN,
    sshHost: PUBLIC_SSH_HOST,
    sshUser: "ubuntu",
    sshKey: SSH_KEY,
    ...overrides,
  };
}

function saveVdsBody(overrides: Record<string, unknown> = {}) {
  return {
    ownerToken: OWNER_TOKEN,
    sshHost: PUBLIC_SSH_HOST,
    sshUser: "ubuntu",
    sshKey: SSH_KEY,
    ...overrides,
  };
}

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
  app.use(vdsRouter);
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
  mockIsWalletCryptoEnabled.mockReturnValue(true);
  mockEncryptSshKey.mockImplementation((key: string) => `enc:${key}`);
  mockSshConnect.mockImplementation(() => undefined);
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
  mockDb.delete.mockImplementation(() => ({
    where: vi.fn(async () => nextResult()),
  }));
});

describe("POST /quotas/vds/test-connection", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/quotas/vds/test-connection", {
      body: { ownerToken: OWNER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/quotas/vds/test-connection", {
      body: testConnectionBody(),
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns 400 for private SSH host (SSRF block)", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const res = await request("POST", "/quotas/vds/test-connection", {
      body: testConnectionBody({ sshHost: "127.0.0.1" }),
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      ok: false,
      error: "Host is not reachable from the platform",
    });
  });

  it("returns ok:true when SSH connection succeeds", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const res = await request("POST", "/quotas/vds/test-connection", {
      body: testConnectionBody(),
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(mockSshConnect).toHaveBeenCalled();
  });
});

describe("POST /quotas/:quotaId/vds", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: { ownerToken: OWNER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody(),
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when quota is missing", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody(),
    });
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Quota not found" });
  });

  it("returns 403 when quota belongs to another owner", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([{ ...QUOTA, ownerId: "other-host" }]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody(),
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your quota" });
  });

  it("returns 503 when wallet encryption is unavailable", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    mockIsWalletCryptoEnabled.mockReturnValue(false);
    queueResults([QUOTA]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody(),
    });
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({ error: "encryption_unavailable" });
  });

  it("creates VDS config when none exists", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([QUOTA], [], [VDS_ROW]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody(),
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      id: VDS_ID,
      quotaId: QUOTA_ID,
      sshHost: PUBLIC_SSH_HOST,
      sshUser: "ubuntu",
      status: "pending",
    });
    expect(mockEncryptSshKey).toHaveBeenCalledWith(SSH_KEY);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updates existing VDS config", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const updated = { ...VDS_ROW, sshHost: "203.0.113.2", status: "pending" };
    queueResults([QUOTA], [VDS_ROW], [updated]);
    const res = await request("POST", `/quotas/${QUOTA_ID}/vds`, {
      body: saveVdsBody({ sshHost: "203.0.113.2" }),
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: VDS_ID,
      sshHost: "203.0.113.2",
    });
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("GET /quotas/:quotaId/vds", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("GET", `/quotas/${QUOTA_ID}/vds`);
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "ownerToken required" });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request(
      "GET",
      `/quotas/${QUOTA_ID}/vds?ownerToken=bad`,
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when quota is missing", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([]);
    const res = await request(
      "GET",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "Quota not found" });
  });

  it("returns 403 when quota belongs to another owner", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([{ ...QUOTA, ownerId: "other-host" }]);
    const res = await request(
      "GET",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your quota" });
  });

  it("returns 404 when VDS is not configured", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([QUOTA], []);
    const res = await request(
      "GET",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "No VDS configured" });
  });

  it("returns shaped VDS without SSH key", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([QUOTA], [VDS_ROW]);
    const res = await request(
      "GET",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      id: VDS_ID,
      quotaId: QUOTA_ID,
      sshHost: PUBLIC_SSH_HOST,
      sshUser: "ubuntu",
      status: "pending",
    });
    expect(res.json).not.toHaveProperty("sshKey");
    expect(res.json).not.toHaveProperty("sshKeyEncrypted");
  });
});

describe("DELETE /quotas/:quotaId/vds", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("DELETE", `/quotas/${QUOTA_ID}/vds`);
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "ownerToken required" });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request(
      "DELETE",
      `/quotas/${QUOTA_ID}/vds?ownerToken=bad`,
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns 403 when quota is missing or not owned", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([]);
    const res = await request(
      "DELETE",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not your quota" });
  });

  it("deletes VDS config for owned quota", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([QUOTA]);
    const res = await request(
      "DELETE",
      `/quotas/${QUOTA_ID}/vds?ownerToken=${OWNER_TOKEN}`,
    );
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("GET /vds/mine", () => {
  it("returns 400 when ownerToken is missing", async () => {
    const res = await request("GET", "/vds/mine");
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "ownerToken required" });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("GET", "/vds/mine?ownerToken=bad");
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns empty array when owner has no quotas", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    queueResults([]);
    const res = await request("GET", `/vds/mine?ownerToken=${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([]);
  });

  it("returns VDS list with quota title and earned LZT", async () => {
    mockResolveOwnerByToken.mockResolvedValue({ id: HOST_ID, type: "host" });
    const vdsWithHost = {
      ...VDS_ROW,
      id: "vds-with-host",
      hostId: HOST_VDS_ID,
    };
    queueResults(
      [{ id: QUOTA_ID, title: "Test Quota" }],
      [vdsWithHost],
      [{ withdrawableBalanceLzt: 500, internalBalanceLzt: 300 }],
    );
    const res = await request("GET", `/vds/mine?ownerToken=${OWNER_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.json).toEqual([
      expect.objectContaining({
        id: "vds-with-host",
        quotaId: QUOTA_ID,
        quotaTitle: "Test Quota",
        earnedLzt: 800,
        sshHost: PUBLIC_SSH_HOST,
      }),
    ]);
  });
});
