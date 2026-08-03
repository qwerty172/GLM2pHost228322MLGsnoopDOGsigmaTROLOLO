#!/usr/bin/env node
/**
 * Кроссплатформенный запуск API + Web одной командой (pnpm dev).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(join(root, ".env"))) {
  console.error("Нет .env — сначала: pnpm setup");
  process.exit(1);
}

const isWin = process.platform === "win32";
const pnpm = isWin ? "pnpm.cmd" : "pnpm";

const children = [];

function run(label, args) {
  const child = spawn(pnpm, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${label}] остановлен (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${label}] завершился с кодом ${code}`);
    }
    shutdown(code ?? 1);
  });
  children.push(child);
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("==> API  http://localhost:8080/api/healthz");
console.log("==> Web  http://localhost:5000");
console.log("Ctrl+C — остановить оба процесса\n");

run("api", ["--filter", "@workspace/api-server", "run", "dev"]);
run("web", ["--filter", "@workspace/web", "run", "dev"]);
