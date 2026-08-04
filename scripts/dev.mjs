#!/usr/bin/env node
import { existsSync } from "node:fs";
import { ENV_PATH, loadEnvIntoProcess, log, spawnPnpm, warn } from "./lib/dx.mjs";

const API_PORT = process.env.API_PORT ?? "8080";
const WEB_PORT = process.env.WEB_PORT ?? "5000";

function main() {
  if (!existsSync(ENV_PATH)) {
    warn("Нет .env — сначала: pnpm bootstrap");
    process.exit(1);
  }

  loadEnvIntoProcess();

  const children = [];

  const stopAll = (signal) => {
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  process.on("SIGINT", () => {
    stopAll("SIGTERM");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopAll("SIGTERM");
    process.exit(0);
  });

  log("==> API (http://localhost:" + API_PORT + ")");
  const api = spawnPnpm(["--filter", "@workspace/api-server", "run", "dev"], {
    env: { PORT: API_PORT },
  });
  children.push(api);

  log("==> Web (http://localhost:" + WEB_PORT + ")");
  const web = spawnPnpm(["--filter", "@workspace/web", "run", "dev"], {
    env: { WEB_PORT, PORT: WEB_PORT },
  });
  children.push(web);

  log("");
  log("API:  http://localhost:" + API_PORT + "/api/healthz");
  log("Web:  http://localhost:" + WEB_PORT);
  log("Игра: http://localhost:" + WEB_PORT + "/games/rogue-fable-3");
  log("Ctrl+C — остановить");
  log("");

  for (const child of children) {
    child.on("exit", (code, signal) => {
      if (signal) {
        return;
      }
      if (code && code !== 0) {
        stopAll("SIGTERM");
        process.exit(code);
      }
    });
  }
}

main();
