#!/usr/bin/env node
/**
 * pnpm dev — API + Web одной командой.
 */
import { spawn } from "node:child_process";
import { ROOT, fileExists, log, die } from "./lib/dx.mjs";

if (!fileExists(".env")) {
  die("Нет .env — сначала запусти: pnpm bootstrap");
}

const children = [];

function spawnPnpm(filter, script) {
  const child = spawn(
    "pnpm",
    ["--filter", filter, "run", script],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    },
  );
  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) cleanup(code ?? 1);
  });
  return child;
}

function cleanup(code = 0) {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

log("==> API-сервер (порт 8080)");
spawnPnpm("@workspace/api-server", "dev");

log("==> Web (http://localhost:5000, прокси /api → API)");
spawnPnpm("@workspace/web", "dev");

log("");
log("API:  http://localhost:8080/api/healthz");
log("Web:  http://localhost:5000");
log("Ctrl+C — остановить оба процесса");
log("");
