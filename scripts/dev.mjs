#!/usr/bin/env node
/**
 * Запуск API + Web одной командой. Web стартует после /api/healthz.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

if (!existsSync(resolve(root, ".env"))) {
  console.error("Нет .env — сначала: pnpm bootstrap");
  process.exit(1);
}

const apiPort = process.env.PORT ?? "8080";
const webPort = process.env.WEB_PORT ?? "5000";
const healthUrl = `http://127.0.0.1:${apiPort}/api/healthz`;
const maxWaitMs = Number(process.env.DEV_HEALTH_TIMEOUT_MS ?? 120_000);
const pollMs = 500;

const children = [];

function spawnPnpm(args, label) {
  const child = spawn("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env },
  });
  child.on("error", (err) => {
    console.error(`[${label}]`, err.message);
    shutdown(1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.status === "ok") return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  console.error(`API не ответил на ${healthUrl} за ${maxWaitMs / 1000}с`);
  shutdown(1);
}

console.log("==> API-сервер (порт", apiPort + ")");
spawnPnpm(["--filter", "@workspace/api-server", "run", "dev"], "api");

console.log("==> Ожидание", healthUrl);
await waitForHealth();
console.log("✓ API готов\n");

console.log("==> Web (порт", webPort + ", прокси /api → :" + apiPort + ")");
const webChild = spawnPnpm(["--filter", "@workspace/web", "run", "dev"], "web");

console.log("\n  API:  http://localhost:" + apiPort + "/api/healthz");
console.log("  Web:  http://localhost:" + webPort);
console.log("  Демо: http://localhost:" + webPort + "/games/rogue-fable-3");
console.log("\nCtrl+C — остановить\n");

await new Promise((resolve) => {
  webChild.on("exit", (code) => resolve(code ?? 0));
});
