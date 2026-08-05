import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import AdmZip from "adm-zip";
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

// Controls what `resolveBundledHostToken`'s DB lookup "finds" (U-32): a row
// present means the requested token belongs to a real host, empty means it
// doesn't (or the request was unauthenticated).
let dbHostTokenRows: Array<{ hostToken: string }> = [];
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => dbHostTokenRows),
        })),
      })),
    })),
  },
  hostsTable: { id: "id", hostToken: "hostToken" },
}));

const AGENT_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "host-agent",
);
const DIST_DIR = path.join(AGENT_DIR, "dist");
const hadDistBefore = existsSync(DIST_DIR);

const {
  default: downloadsRouter,
  resolveApiBaseUrl,
  buildBundledAgentConfig,
  resetHostAgentExeUrlCacheForTests,
} = await import("./downloads");

// Controllable mock for GitHub's `GET /repos/:repo/releases/latest`. Real
// network calls would be flaky/blocked in CI, so we intercept only requests
// to api.github.com and pass everything else (the local test server) through
// to the real fetch implementation.
const realFetch = globalThis.fetch;
let githubReleaseResponse: { status: number; body: unknown } | null = null;
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("api.github.com")) {
      const mocked = githubReleaseResponse ?? { status: 404, body: { message: "Not Found" } };
      return new Response(JSON.stringify(mocked.body), {
        status: mocked.status,
        headers: { "content-type": "application/json" },
      });
    }
    return realFetch(input, init);
  }),
);

let baseUrl = "";
let server: Server;

async function request(
  method: string,
  path: string,
  opts: {
    headers?: Record<string, string>;
    redirect?: RequestRedirect;
  } = {},
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: opts.headers,
    redirect: opts.redirect ?? "follow",
  });
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  let json: unknown = undefined;
  if (contentType.includes("application/json") && text) {
    json = JSON.parse(text);
  }
  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
    buffer: Buffer.from(text, "binary"),
  };
}

beforeAll(async () => {
  if (!hadDistBefore) {
    mkdirSync(DIST_DIR, { recursive: true });
    writeFileSync(path.join(DIST_DIR, "stub.js"), "// marathon test stub\n");
  }

  const app = express();
  app.use((req, _res, next) => {
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(downloadsRouter);
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
  if (!hadDistBefore && existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  delete process.env.HOST_AGENT_EXE_URL;
  githubReleaseResponse = null;
  resetHostAgentExeUrlCacheForTests();
  dbHostTokenRows = [];
});

describe("resolveApiBaseUrl", () => {
  it("uses request host and protocol", () => {
    const req = {
      protocol: "http",
      get(name: string) {
        if (name === "host") return "127.0.0.1:5000";
        return undefined;
      },
    };
    expect(resolveApiBaseUrl(req as never)).toBe("http://127.0.0.1:5000");
  });

  it("prefers x-forwarded headers behind a proxy", () => {
    const req = {
      protocol: "http",
      get(name: string) {
        if (name === "x-forwarded-proto") return "https,http";
        if (name === "x-forwarded-host") return "gaming.example.com,internal";
        if (name === "host") return "127.0.0.1:5000";
        return undefined;
      },
    };
    expect(resolveApiBaseUrl(req as never)).toBe("https://gaming.example.com");
  });
});

describe("buildBundledAgentConfig", () => {
  it("includes apiBaseUrl only when host token is absent", () => {
    expect(buildBundledAgentConfig("https://gaming.example.com")).toEqual({
      apiBaseUrl: "https://gaming.example.com",
    });
  });

  it("embeds hostToken when provided", () => {
    expect(
      buildBundledAgentConfig("https://gaming.example.com", "host-tok-abc"),
    ).toEqual({
      apiBaseUrl: "https://gaming.example.com",
      hostToken: "host-tok-abc",
    });
  });

  it("trims hostToken whitespace", () => {
    expect(
      buildBundledAgentConfig("https://gaming.example.com", "  tok  "),
    ).toEqual({
      apiBaseUrl: "https://gaming.example.com",
      hostToken: "tok",
    });
  });
});

describe("GET /downloads/host-agent.exe", () => {
  it("returns a clear 503 when no GitHub Release and no override are available (U-31)", async () => {
    githubReleaseResponse = { status: 404, body: { message: "Not Found" } };
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("host-agent-v"),
    });
  });

  it("redirects to HOST_AGENT_EXE_URL override even when a release exists", async () => {
    process.env.HOST_AGENT_EXE_URL =
      "https://cdn.example.com/host-agent.exe";
    const res = await request("GET", "/downloads/host-agent.exe", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(process.env.HOST_AGENT_EXE_URL);
  });

  it("auto-resolves the latest GitHub Release installer asset (U-31)", async () => {
    githubReleaseResponse = {
      status: 200,
      body: {
        tag_name: "host-agent-v1.2.3",
        assets: [
          { name: "host-agent-Setup-1.2.3.exe", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe" },
          { name: "host-agent-Setup-1.2.3.exe.blockmap", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe.blockmap" },
        ],
      },
    };
    const res = await request("GET", "/downloads/host-agent.exe", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe",
    );
  });

  it("returns 503 when the latest release has no .exe asset", async () => {
    githubReleaseResponse = {
      status: 200,
      body: { tag_name: "v0.0.1", assets: [{ name: "README.txt", browser_download_url: "https://example.com/README.txt" }] },
    };
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
  });

  it("caches the resolved release URL instead of re-querying GitHub every request", async () => {
    githubReleaseResponse = {
      status: 200,
      body: {
        tag_name: "host-agent-v1.0.0",
        assets: [{ name: "host-agent-Setup-1.0.0.exe", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.0.0/host-agent-Setup-1.0.0.exe" }],
      },
    };
    await request("GET", "/downloads/host-agent.exe", { redirect: "manual" });
    const callsAfterFirst = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("api.github.com"),
    ).length;
    // Change the mocked response — a cached lookup must NOT pick this up immediately.
    githubReleaseResponse = { status: 404, body: {} };
    const res2 = await request("GET", "/downloads/host-agent.exe", { redirect: "manual" });
    expect(res2.status).toBe(302);
    const callsAfterSecond = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("api.github.com"),
    ).length;
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});

describe("GET /downloads/host-agent.zip", () => {
  it("returns 503 when host-agent dist is missing", async () => {
    const distExisted = existsSync(DIST_DIR);
    if (distExisted) {
      rmSync(DIST_DIR, { recursive: true, force: true });
    }

    try {
      const res = await request("GET", "/downloads/host-agent.zip");
      expect(res.status).toBe(503);
      expect(res.json).toMatchObject({
        error: expect.stringContaining("has not been built"),
      });
    } finally {
      if (distExisted) {
        mkdirSync(DIST_DIR, { recursive: true });
        writeFileSync(path.join(DIST_DIR, "stub.js"), "// marathon test stub\n");
      } else if (!existsSync(DIST_DIR)) {
        mkdirSync(DIST_DIR, { recursive: true });
        writeFileSync(path.join(DIST_DIR, "stub.js"), "// marathon test stub\n");
      }
    }
  });

  it("streams a zip bundle with portable launcher files", async () => {
    const res = await request("GET", "/downloads/host-agent.zip");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain(
      'filename="cloud-gaming-host-agent.zip"',
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(res.buffer.includes(Buffer.from("start.bat"))).toBe(true);
    expect(res.buffer.includes(Buffer.from("INSTALL.txt"))).toBe(true);
    expect(res.buffer.includes(Buffer.from("config.json"))).toBe(true);
    expect(res.buffer.includes(Buffer.from("package.json"))).toBe(true);
  });

  // U-32: the byte-search assertions above only prove the *filename* is
  // present in the archive — they would still pass if config.json existed
  // but was missing hostToken (exactly the regression U-02 must prevent).
  // These tests actually unzip the archive and parse config.json as JSON.
  it("embeds the real hostToken inside config.json when the request is authenticated (U-32)", async () => {
    dbHostTokenRows = [{ hostToken: "host-token-real-abc123" }];
    const rawRes = await fetch(`${baseUrl}/downloads/host-agent.zip`, {
      headers: { Authorization: "Bearer host-token-real-abc123" },
    });
    expect(rawRes.status).toBe(200);
    const zip = new AdmZip(Buffer.from(await rawRes.arrayBuffer()));
    const entry = zip.getEntry("config.json");
    expect(entry).not.toBeNull();
    const config = JSON.parse(zip.readAsText(entry!)) as {
      apiBaseUrl?: string;
      hostToken?: string;
    };
    expect(config.hostToken).toBe("host-token-real-abc123");
    expect(config.apiBaseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("does not embed a hostToken when the request is unauthenticated", async () => {
    const rawRes = await fetch(`${baseUrl}/downloads/host-agent.zip`);
    const zip = new AdmZip(Buffer.from(await rawRes.arrayBuffer()));
    const config = JSON.parse(
      zip.readAsText(zip.getEntry("config.json")!),
    ) as { hostToken?: string };
    expect(config.hostToken).toBeUndefined();
  });

  it("does not embed a hostToken for an unrecognized token (no matching host)", async () => {
    dbHostTokenRows = []; // token doesn't match any host row
    const rawRes = await fetch(`${baseUrl}/downloads/host-agent.zip`, {
      headers: { Authorization: "Bearer some-unknown-token" },
    });
    const zip = new AdmZip(Buffer.from(await rawRes.arrayBuffer()));
    const config = JSON.parse(
      zip.readAsText(zip.getEntry("config.json")!),
    ) as { hostToken?: string };
    expect(config.hostToken).toBeUndefined();
  });
});
