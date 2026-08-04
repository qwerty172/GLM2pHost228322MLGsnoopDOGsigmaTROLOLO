#!/usr/bin/env node
/**
 * pnpm dev — параллельный запуск API (:8080) и Web (:5000).
 */
import { existsSync } from "node:fs";
import {
  ENV_PATH,
  die,
  getEnvValue,
  log,
  spawnLogged,
} from "./lib/dx.mjs";

if (!existsSync(ENV_PATH)) {
  die("Нет .env — сначала: pnpm bootstrap");
}

const webPort = getEnvValue("WEB_PORT") || "5000";
const apiPort = getEnvValue("PORT") || "8080";

const children = [];

function shutdown(signal) {
  for (const child of children) {
    try {
      child.kill(signal);
    } catch {
      /* noop */
    }
  }
}

process.on("SIGINT", () => {
  log("\nОстанавливаем серверы…");
  shutdown("SIGTERM");
  setTimeout(() => process.exit(0), 500);
});
process.on("SIGTERM", () => shutdown("SIGTERM"));

const apiEnv = { ...process.env };
const webEnv = {
  ...process.env,
  // Vite читает PORT; WEB_PORT — отдельный порт web в .env
  PORT: webPort,
  WEB_PORT: webPort,
};

log("==> API-сервер");
const api = spawnLogged(
  "api",
  "pnpm",
  ["--filter", "@workspace/api-server", "run", "dev"],
  apiEnv,
);
children.push(api);

log("==> Web");
const web = spawnLogged(
  "web",
  "pnpm",
  ["--filter", "@workspace/web", "run", "dev"],
  webEnv,
);
children.push(web);

log("");
log(`API:  http://localhost:${apiPort}/api/healthz`);
log(`Web:  http://localhost:${webPort}`);
log("Ctrl+C — остановить оба процесса");
log("");

api.on("exit", (code) => {
  if (code && code !== 0) die(`API завершился с кодом ${code}`, code);
});
web.on("exit", (code) => {
  if (code && code !== 0) die(`Web завершился с кодом ${code}`, code);
});
