#!/usr/bin/env node
/**
 * Start API + Web dev servers (cross-platform).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  ENV_FILE,
  ROOT,
  die,
  log,
  readEnvFile,
  warn,
} from "./lib/dx.mjs";

if (!existsSync(ENV_FILE)) {
  die("Нет .env — сначала: pnpm setup");
}

const env = readEnvFile();
const apiPort = env.PORT || "8080";
const webPort = env.WEB_PORT || "5000";

const children = [];

function spawnService(label, cmd, args, extraEnv = {}) {
  log(`==> ${label}`);
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("error", (err) => {
    console.error(`${label} error:`, err.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code !== 0 && code !== null) {
      console.error(`${label} завершился с кодом ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => {
  log("\nОстановка...");
  shutdown(0);
});
process.on("SIGTERM", () => shutdown(0));

log("DecentralHub — dev\n");
log(`API:  http://localhost:${apiPort}/api/healthz`);
log(`Web:  http://localhost:${webPort}`);
log("Ctrl+C — остановить оба процесса\n");

spawnService(
  "API-сервер",
  "pnpm",
  ["--filter", "@workspace/api-server", "run", "dev"],
);

// Небольшая задержка — API успевает собраться до первых запросов с web
setTimeout(() => {
  spawnService("Web (Vite)", "pnpm", [
    "--filter",
    "@workspace/web",
    "run",
    "dev",
  ]);
}, process.platform === "win32" ? 2000 : 500);
