#!/usr/bin/env node
/**
 * Docker infra helper: postgres + redis (+ optional coturn).
 *
 * Usage:
 *   node scripts/infra.mjs up
 *   node scripts/infra.mjs up --coturn
 *   node scripts/infra.mjs down
 */
import { compose, die, dockerAvailable, log, warn } from "./lib/dx.mjs";

const [action = "up"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const withCoturn = process.argv.includes("--coturn");

async function main() {
  if (!dockerAvailable()) die("Docker не найден — установи Docker Desktop / docker CLI");

  if (action === "up") {
    const services = withCoturn
      ? ["postgres", "redis", "coturn"]
      : ["postgres", "redis"];
    log(`==> docker compose up: ${services.join(", ")}`);
    await compose(["up", "-d", ...services], { inherit: true });
    log("\nPostgres: postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub");
    log("Redis:    redis://localhost:6379");
    if (withCoturn) warn("coturn: настрой TURN_SECRET и TURN_URLS в .env");
    return;
  }

  if (action === "down") {
    log("==> docker compose down");
    await compose(["down"], { inherit: true });
    return;
  }

  die(`Неизвестная команда: ${action}. Используй: up | down`);
}

main().catch((e) => die(e.message ?? String(e)));
