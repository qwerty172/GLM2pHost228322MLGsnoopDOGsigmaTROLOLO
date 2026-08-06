#!/usr/bin/env node
/**
 * Запуск API + Web одной командой с правильными портами.
 * Запуск: pnpm dev
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./lib/env-file.mjs";
import { hasDocker, hasComposeFile, dockerComposeUp } from "./lib/docker.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env");

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function spawnDev(name, filter, extraEnv) {
  const child = spawn(
    "pnpm",
    ["--filter", filter, "run", "dev"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
      shell: process.platform === "win32",
    },
  );
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${name}] завершён сигналом ${signal}`);
      shutdown(1);
      return;
    }
    if (code && code !== 0) {
      console.error(`[${name}] завершён с кодом ${code}`);
      shutdown(code);
    }
  });
  children.push(child);
  return child;
}

async function main() {
  if (!existsSync(ENV_FILE)) {
    console.error("Нет .env — сначала: pnpm setup");
    process.exit(1);
  }

  const fileEnv = readEnvFile(ENV_FILE);

  if (hasDocker() && hasComposeFile()) {
    console.log("==> Docker: postgres + redis (если ещё не запущены)");
    dockerComposeUp(["postgres", "redis"]);
  }

  const apiPort = fileEnv.PORT || "8080";
  const webPort = fileEnv.WEB_PORT || "5000";

  console.log("\n==> API (порт %s)", apiPort);
  spawnDev("api", "@workspace/api-server", { PORT: apiPort });

  // Даём API чуть времени на bind до старта Vite.
  await new Promise((r) => setTimeout(r, 1_500));

  console.log("==> Web (http://localhost:%s)", webPort);
  spawnDev("web", "@workspace/web", {
    WEB_PORT: webPort,
    BASE_PATH: fileEnv.BASE_PATH || "/",
    API_PROXY_TARGET: fileEnv.API_PROXY_TARGET || `http://localhost:${apiPort}`,
  });

  console.log("\n  Web:  http://localhost:%s", webPort);
  console.log("  API:  http://localhost:%s/api/healthz", apiPort);
  console.log("  Демо: http://localhost:%s/games/rogue-fable-3", webPort);
  console.log("\nCtrl+C — остановить оба процесса\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
