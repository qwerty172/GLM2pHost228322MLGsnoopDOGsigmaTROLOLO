#!/usr/bin/env node
/**
 * Запуск API + Web для локальной разработки (кроссплатформенно).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./lib/env-file.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env");

if (!existsSync(envPath)) {
  console.error("Нет .env — сначала: pnpm setup");
  process.exit(1);
}

const env = parseEnvFile(envPath);
const apiPort = env.PORT || "8080";
const webPort = env.WEB_PORT || "5000";
const healthUrl = `http://localhost:${apiPort}/api/healthz`;

const children = [];

function spawnPnpm(args, label) {
  const child = spawn("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });
  child.on("error", (err) => {
    console.error(`[${label}]`, err.message);
  });
  children.push(child);
  return child;
}

async function waitForHealth(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return;
    } catch {
      /* API ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API не ответил на ${healthUrl} за ${timeoutMs / 1000}s`);
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

console.log("==> API (порт " + apiPort + ")");
spawnPnpm(["--filter", "@workspace/api-server", "run", "dev"], "api");

console.log("==> Ожидание API…");
try {
  await waitForHealth();
  console.log("✓ API готов");
} catch (err) {
  console.error(err.message);
  shutdown();
  process.exit(1);
}

console.log("==> Web (http://localhost:" + webPort + ")");
spawnPnpm(["--filter", "@workspace/web", "run", "dev"], "web");

console.log("");
console.log("API:  http://localhost:" + apiPort + "/api/healthz");
console.log("Web:  http://localhost:" + webPort);
console.log("Демо: http://localhost:" + webPort + "/games/rogue-fable-3");
console.log("Ctrl+C — остановить");
console.log("");

await new Promise(() => {});
