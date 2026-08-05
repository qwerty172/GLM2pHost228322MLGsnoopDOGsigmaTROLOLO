#!/usr/bin/env node
/**
 * pnpm dev — API :8080 + Web :5000 в одном терминале.
 */
import { existsSync } from "node:fs";
import {
  ENV_FILE,
  log,
  spawnDev,
} from "./lib/dx.mjs";

if (!existsSync(ENV_FILE)) {
  console.error("Нет .env — сначала: pnpm bootstrap");
  process.exit(1);
}

const children = [];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
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

log("==> API-сервер (порт 8080)");
children.push(
  spawnDev("api", "pnpm", ["--filter", "@workspace/api-server", "run", "dev"]),
);

log("==> Web (http://localhost:5000, прокси /api → API)");
children.push(
  spawnDev("web", "pnpm", ["--filter", "@workspace/web", "run", "dev"], {
    WEB_PORT: "5000",
    BASE_PATH: "/",
  }),
);

log(`
API:  http://localhost:8080/api/healthz
Web:  http://localhost:5000
Ctrl+C — остановить оба процесса
`);

await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on("exit", resolve);
      }),
  ),
);
