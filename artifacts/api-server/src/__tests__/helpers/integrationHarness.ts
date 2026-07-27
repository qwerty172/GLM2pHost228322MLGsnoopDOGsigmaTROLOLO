import { createServer, type Server } from "node:http";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

export type IntegrationCtx = {
  server: Server;
  baseUrl: string;
  pool: import("pg").Pool;
  db: typeof import("@workspace/db").db;
  tables: typeof import("@workspace/db");
};

export async function setupIntegrationHarness(
  dbUrl: string,
): Promise<IntegrationCtx> {
  process.env.DATABASE_URL = dbUrl;
  process.env.RATE_LIMIT_STORAGE = "memory";

  execSync("pnpm exec drizzle-kit push --force --config ./drizzle.config.ts", {
    cwd: join(ROOT, "lib/db"),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  const tables = await import("@workspace/db");
  const { default: app } = await import("../../app");
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");

  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    pool: tables.pool,
    db: tables.db,
    tables,
  };
}

export async function teardownIntegrationHarness(ctx: IntegrationCtx): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ctx.server.close((err) => (err ? reject(err) : resolve()));
  });
  await ctx.pool.end();
}

export async function api(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, data };
}

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
