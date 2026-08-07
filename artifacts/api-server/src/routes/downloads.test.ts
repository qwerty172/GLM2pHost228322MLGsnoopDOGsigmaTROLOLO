import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { EventEmitter } from "node:events";
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

let archiverShouldFail = false;

vi.mock("archiver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("archiver")>();
  return {
    default: vi.fn((format: string, options?: unknown) => {
      if (!archiverShouldFail) {
        return actual.default(format, options);
      }
      const archive = Object.assign(new EventEmitter(), {
        pipe: vi.fn().mockReturnThis(),
        directory: vi.fn().mockReturnThis(),
        file: vi.fn().mockReturnThis(),
        append: vi.fn().mockReturnThis(),
        abort: vi.fn(),
        finalize: vi.fn(async () => {
          archive.emit("error", new Error("archiver failed"));
        }),
      });
      return archive;
    }),
  };
});

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
  resolveHostAgentExeUrl,
  pickInstallerUrlFromReleases,
} = await import("./downloads");

// Controllable mock for GitHub's `GET /repos/:repo/releases/latest`. Real
// network calls would be flaky/blocked in CI, so we intercept only requests
// to api.github.com and pass everything else (the local test server) through
// to the real fetch implementation.
const realFetch = globalThis.fetch;
let githubReleaseResponse: { status: number; body: unknown } | null = null;

/** How many times the GitHub API has been called through the stubbed fetch. */
function githubApiCallCount(): number {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
    String(c[0]).includes("api.github.com"),
  ).length;
}

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
  archiverShouldFail = false;
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

  it("returns Russian ZIP fallback when installer is not published (U-36)", async () => {
    githubReleaseResponse = { status: 404, body: { message: "Not Found" } };
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
    const body = res.json as { error?: string };
    expect(body.error).toMatch(/не опубликован/i);
    expect(body.error).toMatch(/ZIP/i);
    expect(body.error).toMatch(/host-agent-v/);
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
      body: [
        {
          tag_name: "host-agent-v1.2.3",
          assets: [
            { name: "host-agent-Setup-1.2.3.exe", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe" },
            { name: "host-agent-Setup-1.2.3.exe.blockmap", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe.blockmap" },
          ],
        },
      ],
    };
    const res = await request("GET", "/downloads/host-agent.exe", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://github.com/x/releases/download/host-agent-v1.2.3/host-agent-Setup-1.2.3.exe",
    );
  });

  it("returns 503 when the host-agent release has no .exe asset", async () => {
    githubReleaseResponse = {
      status: 200,
      body: [
        { tag_name: "host-agent-v0.0.1", assets: [{ name: "README.txt", browser_download_url: "https://example.com/README.txt" }] },
      ],
    };
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
  });

  it("skips releases of other monorepo components and picks the host-agent one", async () => {
    githubReleaseResponse = {
      status: 200,
      body: [
        // Newest release belongs to something else and has no installer.
        { tag_name: "web-v9.9.9", assets: [{ name: "web-bundle.zip", browser_download_url: "https://example.com/web.zip" }] },
        // Older, but it is the agent's own tag prefix.
        {
          tag_name: "host-agent-v1.1.0",
          assets: [{ name: "host-agent-Setup-1.1.0.exe", browser_download_url: "https://github.com/x/host-agent-Setup-1.1.0.exe" }],
        },
      ],
    };
    const res = await request("GET", "/downloads/host-agent.exe", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://github.com/x/host-agent-Setup-1.1.0.exe",
    );
  });

  it("returns 503 when a GitHub request fails or times out", async () => {
    githubReleaseResponse = { status: 500, body: { message: "boom" } };
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
  });

  it("shares a single GitHub lookup between concurrent cold-cache requests", async () => {
    githubReleaseResponse = {
      status: 200,
      body: [
        {
          tag_name: "host-agent-v2.0.0",
          assets: [{ name: "host-agent-Setup-2.0.0.exe", browser_download_url: "https://github.com/x/2.0.0.exe" }],
        },
      ],
    };
    const before = githubApiCallCount();
    const results = await Promise.all([
      resolveHostAgentExeUrl(),
      resolveHostAgentExeUrl(),
      resolveHostAgentExeUrl(),
    ]);
    expect(results).toEqual([
      "https://github.com/x/2.0.0.exe",
      "https://github.com/x/2.0.0.exe",
      "https://github.com/x/2.0.0.exe",
    ]);
    expect(githubApiCallCount() - before).toBe(1);
  });

  it("caches the resolved release URL instead of re-querying GitHub every request", async () => {
    githubReleaseResponse = {
      status: 200,
      body: [
        {
          tag_name: "host-agent-v1.0.0",
          assets: [{ name: "host-agent-Setup-1.0.0.exe", browser_download_url: "https://github.com/x/releases/download/host-agent-v1.0.0/host-agent-Setup-1.0.0.exe" }],
        },
      ],
    };
    await request("GET", "/downloads/host-agent.exe", { redirect: "manual" });
    const callsAfterFirst = githubApiCallCount();
    // Change the mocked response — a cached lookup must NOT pick this up immediately.
    githubReleaseResponse = { status: 404, body: {} };
    const res2 = await request("GET", "/downloads/host-agent.exe", { redirect: "manual" });
    expect(res2.status).toBe(302);
    expect(githubApiCallCount()).toBe(callsAfterFirst);
  });
});

describe("pickInstallerUrlFromReleases", () => {
  it("requires both the host-agent tag prefix and an .exe asset", () => {
    expect(
      pickInstallerUrlFromReleases([
        { tag_name: "host-agent-v1.0.0", assets: [{ name: "notes.txt", browser_download_url: "https://x/notes.txt" }] },
        { tag_name: "other-v2", assets: [{ name: "a.exe", browser_download_url: "https://x/a.exe" }] },
        { tag_name: "host-agent-v0.9.0", assets: [{ name: "b.exe", browser_download_url: "https://x/b.exe" }] },
      ]),
    ).toBe("https://x/b.exe");
  });

  it("returns null for an empty list or when nothing matches", () => {
    expect(pickInstallerUrlFromReleases([])).toBeNull();
    expect(
      pickInstallerUrlFromReleases([
        { tag_name: "v1", assets: [{ name: "setup.exe", browser_download_url: "https://x/setup.exe" }] },
      ]),
    ).toBeNull();
  });

  it("tolerates releases with missing tags, assets or urls", () => {
    expect(
      pickInstallerUrlFromReleases([
        {},
        { tag_name: "host-agent-v1" },
        { tag_name: "host-agent-v1", assets: [] },
        { tag_name: "host-agent-v1", assets: [{ name: "x.exe" }] },
        { tag_name: "host-agent-v1", assets: [{ name: "ok.exe", browser_download_url: "https://x/ok.exe" }] },
      ]),
    ).toBe("https://x/ok.exe");
  });
});

describe("GET /downloads/host-agent.zip", () => {
  it("returns 500 when archiver fails before response headers are sent", async () => {
    archiverShouldFail = true;
    const res = await request("GET", "/downloads/host-agent.zip");
    expect(res.status).toBe(500);
  });

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

  it("bundles INSTALL.txt aligned with dashboard flow — token embedded, no manual paste (U-12)", async () => {
    const rawRes = await fetch(`${baseUrl}/downloads/host-agent.zip`);
    const zip = new AdmZip(Buffer.from(await rawRes.arrayBuffer()));
    const install = zip.readAsText(zip.getEntry("INSTALL.txt")!);
    expect(install).toContain("токен");
    expect(install).toContain("вшит");
    expect(install).toContain("Скачать агент");
    expect(install).toContain("Выйти в онлайн");
    expect(install).not.toMatch(/вставь.*токен/i);
    expect(install).not.toMatch(/скопир.*токен/i);
  });

  it("bundles INSTALL.txt with firewall port range 18080–18083 (U-33)", async () => {
    const rawRes = await fetch(`${baseUrl}/downloads/host-agent.zip`);
    const zip = new AdmZip(Buffer.from(await rawRes.arrayBuffer()));
    const install = zip.readAsText(zip.getEntry("INSTALL.txt")!);
    expect(install).toMatch(/18080.18083/);
    expect(install).toContain("18081");
    expect(install).toContain("18082");
    expect(install).toContain("18083");
    expect(install).not.toMatch(/блокирует порт 18080\?/);
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
