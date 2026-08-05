#!/usr/bin/env node
/**
 * pnpm bootstrap — первичная настройка: .env, секреты, docker, install, db push.
 * Опции:
 *   --no-docker   не поднимать docker (свой PostgreSQL)
 *   --full        + typecheck в конце
 */
import {
  die,
  ensureDockerDatabaseUrl,
  ensureEnvFile,
  ensureSecret,
  hasDocker,
  log,
  run,
  startInfra,
  verifyDatabase,
  waitForPostgres,
} from "./lib/dx.mjs";

const args = new Set(process.argv.slice(2));
const noDocker = args.has("--no-docker");
const full = args.has("--full");

log("==> DecentralHub — bootstrap\n");

ensureEnvFile();
ensureSecret("WALLET_ENCRYPTION_KEY");
ensureSecret("JWT_SECRET");

if (!noDocker) {
  if (hasDocker()) {
    ensureDockerDatabaseUrl();
    startInfra();
    waitForPostgres();
  } else {
    log("Docker не найден — используй свой PostgreSQL (см. DATABASE_URL в .env)");
    const url = process.env.DATABASE_URL;
    if (!url) {
      log("Подсказка: pnpm bootstrap без --no-docker поднимет postgres через docker");
    }
  }
} else {
  log("Режим --no-docker: пропускаем docker infra");
}

log("\n==> pnpm install");
run("pnpm install");

log("\n==> Схема БД (db push)");
run("pnpm --filter @workspace/db run push");

if (!verifyDatabase()) {
  die(
    "PostgreSQL недоступен или db push не применился.\n" +
      "  • С Docker: pnpm bootstrap (поднимет postgres автоматически)\n" +
      "  • Без Docker: запусти PostgreSQL и проверь DATABASE_URL в .env\n" +
      "  • Или: pnpm infra && pnpm bootstrap --no-docker",
  );
}

if (full) {
  log("\n==> Проверка типов");
  run("pnpm run typecheck");
}

log(`
Готово! Запуск:
  pnpm dev      — API :8080 + Web :5000
  pnpm smoke    — smoke-тест API

На потом:
  pnpm setup:full   — bootstrap + typecheck
  pnpm infra        — только docker postgres+redis
  pnpm infra:full   — + coturn (WebRTC/TURN)
  pnpm typecheck    — проверка типов
`);
