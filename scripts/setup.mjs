#!/usr/bin/env node
/**
 * pnpm bootstrap — одна команда для первого запуска.
 * .env + секреты + docker postgres/redis (если есть) + install + db push
 *
 * Флаги:
 *   --no-docker   не поднимать Docker (свой PostgreSQL)
 *   --full        + typecheck в конце (медленнее)
 *   --skip-install  пропустить pnpm install
 */
import {
  ensureEnvFile,
  ensureSecrets,
  hasDocker,
  dockerCompose,
  waitForTcp,
  run,
  log,
  warn,
  parseArgs,
} from "./lib/dx.mjs";

const { flags } = parseArgs(process.argv.slice(2));
const useDocker = !flags.has("--no-docker");
const fullCheck = flags.has("--full");
const skipInstall = flags.has("--skip-install");

log("");
log("==> DecentralHub bootstrap");
log("");

ensureEnvFile();
ensureSecrets();

if (useDocker) {
  if (hasDocker()) {
    log("==> Docker: postgres + redis");
    dockerCompose(["postgres", "redis"]);
    await waitForTcp("127.0.0.1", 5432, { label: "PostgreSQL" });
    log("✓ PostgreSQL готов");
  } else {
    warn("Docker не найден — пропускаем infra (нужен свой PostgreSQL на :5432)");
    warn("Установи Docker или запусти: pnpm bootstrap --no-docker");
  }
} else {
  log("==> Docker пропущен (--no-docker)");
}

if (!skipInstall) {
  log("==> pnpm install");
  run("pnpm", ["install"]);
} else {
  log("==> pnpm install пропущен (--skip-install)");
}

log("==> Схема БД (drizzle push)");
run("pnpm", ["--filter", "@workspace/db", "run", "push"]);

log("==> Проверка подключения к БД");
run("node", ["lib/db/scripts/verify.mjs"]);

if (fullCheck) {
  log("==> Проверка типов (--full)");
  run("pnpm", ["run", "typecheck"]);
}

log("");
log("Готово! Дальше:");
log("  pnpm dev     — API :8080 + Web :5000");
log("  pnpm smoke   — smoke-тест API");
log("");
log("На потом (не обязательно сейчас):");
log("  pnpm setup:full   — bootstrap + typecheck");
log("  pnpm infra        — только Docker postgres+redis");
log("  pnpm infra:full   — + coturn (WebRTC/TURN)");
log("");
