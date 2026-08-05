import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
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

const AGENT_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "host-agent",
);
const DIST_DIR = path.join(AGENT_DIR, "dist");
const hadDistBefore = existsSync(DIST_DIR);

const { default: downloadsRouter, resolveApiBaseUrl } = await import("./downloads");

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

describe("GET /downloads/host-agent.exe", () => {
  it("returns 503 when HOST_AGENT_EXE_URL is not configured", async () => {
    const res = await request("GET", "/downloads/host-agent.exe");
    expect(res.status).toBe(503);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("Installer not available"),
    });
  });

  it("redirects to HOST_AGENT_EXE_URL when configured", async () => {
    process.env.HOST_AGENT_EXE_URL =
      "https://github.com/example/releases/host-agent.exe";
    const res = await request("GET", "/downloads/host-agent.exe", {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(process.env.HOST_AGENT_EXE_URL);
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
});
