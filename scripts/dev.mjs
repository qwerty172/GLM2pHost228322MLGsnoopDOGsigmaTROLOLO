#!/usr/bin/env node
/**
 * Запуск API (:8080) и Web (:5000) в одном терминале.
 * Кроссплатформенно: pnpm dev
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

function spawnService(label, filter) {
  const child = spawn(
    "pnpm",
    ["--filter", filter, "run", "dev"],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    },
  );
  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`\n${label} остановлен (${signal})`);
    } else if (code && code !== 0) {
      console.error(`\n${label} завершился с кодом ${code}`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => {
  console.log("\nОстановка...");
  shutdown(0);
});
process.on("SIGTERM", () => shutdown(0));

console.log("==> DecentralHub — dev (API :8080 + Web :5000)\n");
console.log("API:  http://localhost:8080/api/healthz");
console.log("Web:  http://localhost:5000");
console.log("Ctrl+C — остановить\n");

spawnService("API", "@workspace/api-server");
spawnService("Web", "@workspace/web");
