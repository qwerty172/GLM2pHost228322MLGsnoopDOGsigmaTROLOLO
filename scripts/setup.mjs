#!/usr/bin/env node
import {
  ensureDevSecrets,
  ensureEnvFile,
  loadEnvIntoProcess,
  log,
  runPnpm,
  startInfra,
  verifyDatabase,
  warn,
} from "./lib/dx.mjs";

const args = new Set(process.argv.slice(2));
const skipDocker = args.has("--no-docker");
const full = args.has("--full");

async function main() {
  log("==> DecentralHub — bootstrap");

  ensureEnvFile();
  ensureDevSecrets();
  loadEnvIntoProcess();

  if (!skipDocker) {
    await startInfra(["postgres", "redis"]);
  } else {
    log("Режим --no-docker: используй свой PostgreSQL (см. DATABASE_URL в .env)");
  }

  log("==> pnpm install");
  runPnpm(["install"]);

  log("==> Схема БД (drizzle push)");
  runPnpm(["--filter", "@workspace/db", "run", "push"]);

  if (!verifyDatabase(process.env.DATABASE_URL)) {
    warn("");
    warn("PostgreSQL недоступен — db push не применился.");
    warn("  pnpm infra              — поднять postgres+redis в Docker");
    warn("  pnpm bootstrap --no-docker — если Postgres уже установлен");
    process.exit(1);
  }

  log("База данных готова");

  if (full) {
    log("==> Проверка типов (--full)");
    runPnpm(["run", "typecheck"]);
  } else {
    log("");
    log("Пропущена проверка типов (быстрый режим). На потом: pnpm setup:full");
  }

  log("");
  log("Готово. Запуск:");
  log("  pnpm dev     — API :8080 + Web :5000");
  log("  pnpm smoke   — smoke-тест API");
  log("");
  log("Сразу в игру: http://localhost:5000/games/rogue-fable-3");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
