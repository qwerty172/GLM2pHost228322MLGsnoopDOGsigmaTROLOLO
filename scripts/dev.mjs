#!/usr/bin/env node
/**
 * Запуск API + Web одной командой. Web стартует после готовности /api/healthz.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

function cleanup() {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

function readEnvValue(content, key) {
  return content.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

/**
 * @param {string} url
 * @param {number} maxMs
 */
async function waitHealth(url, maxMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* API ещё поднимается */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API не ответил за ${maxMs / 1000}с: ${url}`);
}

if (!existsSync(join(ROOT, ".env"))) {
  console.error("Нет .env — сначала запустите: pnpm setup");
  process.exit(1);
}

const envContent = readFileSync(join(ROOT, ".env"), "utf8");
const apiPort = readEnvValue(envContent, "PORT") || "8080";
const webPort = readEnvValue(envContent, "WEB_PORT") || "5000";
const healthUrl = `http://127.0.0.1:${apiPort}/api/healthz`;

console.log(`==> API (порт ${apiPort})`);
const api = spawn("pnpm", ["--filter", "@workspace/api-server", "run", "dev"], {
  stdio: "inherit",
  shell: true,
});
children.push(api);

console.log("Ожидание /api/healthz...");
try {
  await waitHealth(healthUrl);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  cleanup();
  process.exit(1);
}

console.log(`\n==> Web (http://localhost:${webPort})`);
const web = spawn("pnpm", ["--filter", "@workspace/web", "run", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    WEB_PORT: webPort,
  },
});
children.push(web);

console.log("");
console.log(`API:  http://localhost:${apiPort}/api/healthz`);
console.log(`Web:  http://localhost:${webPort}`);
console.log("Демо без Windows: http://localhost:" + webPort + "/games/rogue-fable-3");
console.log("Ctrl+C — остановить оба процесса");
console.log("");

await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on("exit", resolve);
      }),
  ),
);
