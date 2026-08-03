#!/usr/bin/env node
/**
 * Запуск API + Web одной командой (кроссплатформенно).
 * Usage: node scripts/dev.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");

if (!existsSync(ENV_PATH)) {
  console.error("Нет .env — сначала: pnpm setup");
  process.exit(1);
}

const children = [];
const shell = process.platform === "win32";

function start(label, args) {
  const child = spawn("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${label}] завершился с кодом ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("==> API (http://localhost:8080)");
start("api", ["--filter", "@workspace/api-server", "run", "dev"]);

console.log("==> Web (http://localhost:5000)");
start("web", ["--filter", "@workspace/web", "run", "dev"]);

console.log(`
API:  http://localhost:8080/api/healthz
Web:  http://localhost:5000
Ctrl+C — остановить оба процесса
`);
