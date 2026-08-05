import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  afterAll,
  afterEach,
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
const VT_API_KEY = "test-vt-api-key";

const CLEAN_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SUSPICIOUS_SHA256 =
  "1111111111111111111111111111111111111111111111111111111111111111";
const MALICIOUS_SHA256 =
  "2222222222222222222222222222222222222222222222222222222222222222";
const UNKNOWN_SHA256 =
  "3333333333333333333333333333333333333333333333333333333333333333";
const ERROR_SHA256 =
  "4444444444444444444444444444444444444444444444444444444444444444";
const LOOKUP_SHA256 =
  "5555555555555555555555555555555555555555555555555555555555555555";

const mockResolveOwnerByToken = vi.fn<
  (token: string) => Promise<{ id: string; type: "host" | "player" } | null>
>();

vi.mock("../lib/walletOwner", () => ({
  resolveOwnerByToken: (token: string) => mockResolveOwnerByToken(token),
}));

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../lib/hostAuth", () => ({
  hostTokenFromRequest: (req: {
    headers?: Record<string, string | string[] | undefined>;
  }) => {
    const xHost = req.headers?.["x-host-token"];
    if (typeof xHost === "string" && xHost.trim()) return xHost.trim();
    if (Array.isArray(xHost) && xHost[0]?.trim()) return xHost[0].trim();
    return null;
  },
}));

const originalFetch = globalThis.fetch.bind(globalThis);
const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const { default: vtRouter } = await import("./vt");

let baseUrl = "";
let server: Server;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockVtFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.startsWith(baseUrl)) {
      return originalFetch(input, init);
    }
    return handler(url, init);
  });
}

function vtFileResponse(
  sha256: string,
  stats: {
    harmless: number;
    suspicious: number;
    malicious: number;
    undetected: number;
  },
  name = "sample.exe",
) {
  return jsonResponse({
    data: {
      attributes: {
        last_analysis_stats: stats,
        sha256,
        meaningful_name: name,
      },
    },
  });
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
  app.use(vtRouter);
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
  vi.clearAllMocks();
  process.env.VIRUSTOTAL_API_KEY = VT_API_KEY;
  process.env.NODE_ENV = "test";
  mockResolveOwnerByToken.mockResolvedValue({ id: "host-1", type: "host" });
  fetchMock.mockImplementation((input, init) => originalFetch(input, init));
});

afterEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => originalFetch(input, init));
  vi.useRealTimers();
});

describe("POST /vt/scan", () => {
  it("returns 503 when VIRUSTOTAL_API_KEY is not configured", async () => {
    delete process.env.VIRUSTOTAL_API_KEY;
    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: CLEAN_SHA256 },
    });
    expect(res.status).toBe(503);
    expect(res.json).toEqual({ error: "VirusTotal не настроен на сервере" });
  });

  it("returns 400 for invalid body", async () => {
    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when owner token is invalid", async () => {
    mockResolveOwnerByToken.mockResolvedValue(null);
    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: "bad", input: CLEAN_SHA256 },
    });
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "Not authenticated" });
  });

  it("returns 400 when input is neither sha256 nor URL", async () => {
    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: "not-a-hash-or-url" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "Укажи SHA-256 хеш (64 hex-символа) или https:// URL",
    });
  });

  it("returns clean result for known sha256 hash", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${CLEAN_SHA256}`)) {
        return vtFileResponse(CLEAN_SHA256, {
          harmless: 60,
          suspicious: 0,
          malicious: 0,
          undetected: 10,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: CLEAN_SHA256 },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "clean",
      harmless: 60,
      suspicious: 0,
      malicious: 0,
      undetected: 10,
      total: 70,
      sha256: CLEAN_SHA256,
      name: "sample.exe",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://www.virustotal.com/api/v3/files/${CLEAN_SHA256}`,
      expect.objectContaining({
        headers: { "x-apikey": VT_API_KEY },
      }),
    );
  });

  it("classifies suspicious and malicious VT stats", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${SUSPICIOUS_SHA256}`)) {
        return vtFileResponse(SUSPICIOUS_SHA256, {
          harmless: 50,
          suspicious: 3,
          malicious: 0,
          undetected: 10,
        });
      }
      if (url.includes(`/files/${MALICIOUS_SHA256}`)) {
        return vtFileResponse(MALICIOUS_SHA256, {
          harmless: 40,
          suspicious: 1,
          malicious: 3,
          undetected: 5,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const suspicious = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: SUSPICIOUS_SHA256 },
    });
    expect(suspicious.status).toBe(200);
    expect(suspicious.json).toMatchObject({ status: "suspicious" });

    const malicious = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: MALICIOUS_SHA256 },
    });
    expect(malicious.status).toBe(200);
    expect(malicious.json).toMatchObject({ status: "malicious" });
  });

  it("returns unknown status when VT has no file record", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${UNKNOWN_SHA256}`)) {
        return jsonResponse({}, 404);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: UNKNOWN_SHA256 },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "unknown",
      sha256: UNKNOWN_SHA256,
      errorMessage: "Файл не найден в базе VirusTotal",
    });
  });

  it("returns 502 when VT file lookup fails", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${ERROR_SHA256}`)) {
        return jsonResponse({}, 500);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("POST", "/vt/scan", {
      body: { ownerToken: OWNER_TOKEN, input: ERROR_SHA256 },
    });
    expect(res.status).toBe(502);
    expect(res.json).toMatchObject({
      status: "error",
      errorMessage: expect.stringContaining("VT API error"),
    });
  });

  it("scans https URL via VT submit and poll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockVtFetch((url, init) => {
      if (url.endsWith("/urls") && init?.method === "POST") {
        return jsonResponse({ data: { id: "analysis-abc" } });
      }
      if (url.includes("/analyses/analysis-abc")) {
        return jsonResponse({
          data: {
            attributes: {
              status: "completed",
              stats: {
                harmless: 55,
                suspicious: 0,
                malicious: 0,
                undetected: 5,
              },
            },
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const promise = request("POST", "/vt/scan", {
      body: {
        ownerToken: OWNER_TOKEN,
        input: "https://example.com/download/setup.exe",
      },
    });
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "clean",
      harmless: 55,
      total: 60,
      permalink: "https://www.virustotal.com/gui/url/analysis-abc",
    });
  });
});

describe("GET /vt/lookup", () => {
  it("returns 503 when VIRUSTOTAL_API_KEY is not configured", async () => {
    delete process.env.VIRUSTOTAL_API_KEY;
    const res = await request("GET", `/vt/lookup?sha256=${CLEAN_SHA256}`);
    expect(res.status).toBe(503);
    expect(res.json).toEqual({ error: "VirusTotal не настроен" });
  });

  it("returns 401 in production without host token", async () => {
    process.env.NODE_ENV = "production";
    const res = await request("GET", `/vt/lookup?sha256=${CLEAN_SHA256}`);
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ error: "X-Host-Token required" });
  });

  it("returns 400 for invalid sha256", async () => {
    const res = await request("GET", "/vt/lookup?sha256=not-a-hash", {
      headers: { "X-Host-Token": "host-token" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Неверный sha256" });
  });

  it("returns VT file lookup for valid sha256", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${LOOKUP_SHA256}`)) {
        return vtFileResponse(LOOKUP_SHA256, {
          harmless: 58,
          suspicious: 1,
          malicious: 0,
          undetected: 11,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("GET", `/vt/lookup?sha256=${LOOKUP_SHA256}`, {
      headers: { "X-Host-Token": "host-token" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      status: "clean",
      harmless: 58,
      suspicious: 1,
      total: 70,
      sha256: LOOKUP_SHA256,
    });
  });

  it("returns 502 when VT lookup fails", async () => {
    mockVtFetch((url) => {
      if (url.includes(`/files/${ERROR_SHA256}`)) {
        return jsonResponse({}, 503);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const res = await request("GET", `/vt/lookup?sha256=${ERROR_SHA256}`, {
      headers: { "X-Host-Token": "host-token" },
    });
    expect(res.status).toBe(502);
    expect(res.json).toEqual({ error: "VT lookup failed" });
  });
});
