#!/usr/bin/env node
/**
 * Быстрая проверка: PostgreSQL, API health, Web.
 * exit 0 — всё ок, exit 1 — что-то недоступно.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvValue(key, fallback) {
  if (process.env[key]) return process.env[key];
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return fallback;
  const match = readFileSync(envPath, "utf8").match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim() || fallback;
}

const apiPort = loadEnvValue("PORT", "8080");
const webPort = loadEnvValue("WEB_PORT", "5000");
let failed = false;

function check(label, ok, detail) {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed = true;
}

const pg = spawnSync("node", [resolve(__dirname, "pg-probe.mjs")], {
  cwd: root,
  stdio: "pipe",
});
check("PostgreSQL", pg.status === 0, pg.status !== 0 ? "pnpm dev:db" : undefined);

let apiOk = false;
try {
  const res = await fetch(`http://127.0.0.1:${apiPort}/api/healthz`, {
    signal: AbortSignal.timeout(2000),
  });
  const body = await res.json().catch(() => ({}));
  apiOk = res.ok && body?.status === "ok";
} catch {
  apiOk = false;
}
check("API", apiOk, apiOk ? `:${apiPort}` : `pnpm dev (ожидается :${apiPort})`);

let webOk = false;
try {
  const res = await fetch(`http://127.0.0.1:${webPort}/`, {
    signal: AbortSignal.timeout(2000),
  });
  webOk = res.ok;
} catch {
  webOk = false;
}
check("Web", webOk, webOk ? `:${webPort}` : `pnpm dev (ожидается :${webPort})`);

if (failed) {
  console.log("\nПодсказка: pnpm quickstart");
  process.exit(1);
}

console.log("\nВсё работает. Демо: http://localhost:" + webPort + "/games/rogue-fable-3");
process.exit(0);
