#!/usr/bin/env node
/**
 * pnpm bootstrap — первичная настройка: .env, секреты, docker, install, db push.
 *
 * Флаги:
 *   --no-docker     не поднимать postgres/redis через docker
 *   --skip-install  пропустить pnpm install
 *   --skip-verify   пропустить проверку подключения к БД
 */
import {
  COMPOSE_FILE,
  DOCKER_DATABASE_URL,
  ENV_EXAMPLE_PATH,
  ENV_PATH,
  die,
  dockerCompose,
  generateSecret,
  getEnvValue,
  hasDocker,
  isDefaultDatabaseUrl,
  isPlaceholderSecret,
  log,
  run,
  setEnvValue,
  waitForPostgres,
  warn,
} from "./lib/dx.mjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const useDocker = !args.has("--no-docker");
const skipInstall = args.has("--skip-install");
const skipVerify = args.has("--skip-verify");

log("==> DecentralHub bootstrap");

// ── .env ──────────────────────────────────────────────────────────────────────
if (!existsSync(ENV_PATH)) {
  if (!existsSync(ENV_EXAMPLE_PATH)) {
    die("Нет .env.example — невозможно создать .env");
  }
  writeFileSync(ENV_PATH, readFileSync(ENV_EXAMPLE_PATH, "utf8"), "utf8");
  log("Создан .env из .env.example");
} else {
  log(".env уже существует");
}

// ── Секреты ───────────────────────────────────────────────────────────────────
const secretKeys = [
  ["WALLET_ENCRYPTION_KEY", 32],
  ["JWT_SECRET", 32],
  ["ADMIN_SECRET", 16],
] ;

for (const [key, bytes] of secretKeys) {
  const current = getEnvValue(key);
  if (isPlaceholderSecret(current)) {
    setEnvValue(key, generateSecret(bytes));
    log(`Сгенерирован ${key}`);
  }
}

// ── Docker postgres + redis ───────────────────────────────────────────────────
let databaseUrl = getEnvValue("DATABASE_URL");

if (useDocker && hasDocker()) {
  log("==> Docker: postgres + redis");
  if (!existsSync(COMPOSE_FILE)) {
    warn(`Нет ${COMPOSE_FILE} — пропускаем docker`);
  } else if (!dockerCompose(["up", "-d", "postgres", "redis"])) {
    warn("docker compose up не удался — проверь Docker или используй --no-docker");
  } else {
    if (isDefaultDatabaseUrl(databaseUrl)) {
      setEnvValue("DATABASE_URL", DOCKER_DATABASE_URL);
      databaseUrl = DOCKER_DATABASE_URL;
      log(`DATABASE_URL → docker (${DOCKER_DATABASE_URL})`);
    }
    log("Ожидание PostgreSQL…");
    if (!waitForPostgres(databaseUrl)) {
      warn("PostgreSQL не ответил за 60с — db push может упасть");
    }
  }
} else if (useDocker) {
  warn("Docker недоступен — используй свой PostgreSQL или установи Docker");
  if (isDefaultDatabaseUrl(databaseUrl)) {
    die(
      "DATABASE_URL не настроен. Отредактируй .env или установи Docker и запусти снова.",
    );
  }
} else {
  log("--no-docker: пропускаем docker compose");
}

databaseUrl = getEnvValue("DATABASE_URL");
if (!databaseUrl) {
  die("DATABASE_URL пустой в .env");
}

// ── pnpm install ──────────────────────────────────────────────────────────────
if (!skipInstall) {
  log("==> pnpm install");
  run("pnpm", ["install"]);
} else {
  log("--skip-install: пропускаем pnpm install");
}

// ── db push ───────────────────────────────────────────────────────────────────
log("==> db push");
run("pnpm", ["--filter", "@workspace/db", "run", "push"]);

// ── verify ────────────────────────────────────────────────────────────────────
if (!skipVerify) {
  log("==> Проверка подключения к БД");
  run("pnpm", ["--filter", "@workspace/db", "run", "verify"]);
}

log("");
log("✓ Готово. Запуск:");
log("  pnpm dev     — API :8080 + Web :5000");
log("  pnpm smoke   — smoke-тест API");
log("");
log("На потом (не обязательно для старта):");
log("  pnpm setup:full  — typecheck");
log("  pnpm infra:full  — + coturn (WebRTC/TURN)");
