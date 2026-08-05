#!/usr/bin/env node
/**
 * Управление локальными зависимостями через Docker Compose.
 * Usage: node scripts/deps.mjs up|down|status [postgres|redis|coturn|all]
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE = "docker compose -f infra/docker-compose.dev.yml";

const action = process.argv[2] ?? "up";
const target = process.argv[3] ?? "core";

const CORE = ["postgres", "redis"];
const ALL = [...CORE, "coturn"];

function servicesFor(target) {
  switch (target) {
    case "postgres":
      return ["postgres"];
    case "redis":
      return ["redis"];
    case "coturn":
      return ["coturn"];
    case "all":
      return ALL;
    case "core":
    default:
      return CORE;
  }
}

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

const svcs = servicesFor(target).join(" ");

switch (action) {
  case "up":
    run(`${COMPOSE} up -d ${svcs}`);
    console.log("\nГотово. Postgres: localhost:5432, Redis: localhost:6379");
    break;
  case "down":
    run(`${COMPOSE} down`);
    break;
  case "status":
    run(`${COMPOSE} ps`);
    break;
  case "logs":
    run(`${COMPOSE} logs -f ${svcs}`);
    break;
  default:
    console.error(`Неизвестная команда: ${action}. Используй: up|down|status|logs`);
    process.exit(1);
}
