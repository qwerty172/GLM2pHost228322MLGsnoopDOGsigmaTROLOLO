#!/usr/bin/env node
/**
 * One-shot local setup: .env, secrets, optional Docker postgres/redis, install, db push.
 *
 * Usage:
 *   node scripts/setup.mjs          # fast path (no typecheck)
 *   node scripts/setup.mjs --full   # + typecheck
 *   node scripts/setup.mjs --no-docker
 */
import {
  ROOT,
  compose,
  die,
  dockerAvailable,
  ensureDevSecrets,
  ensureEnvFile,
  log,
  runInherit,
  waitForPostgres,
  warn,
} from "./lib/dx.mjs";

const args = new Set(process.argv.slice(2));
const full = args.has("--full");
const noDocker = args.has("--no-docker");

async function main() {
  log("==> DecentralHub — настройка (pnpm setup)\n");

  ensureEnvFile();

  let startedDocker = false;
  if (!noDocker && dockerAvailable()) {
    log("==> Docker: postgres + redis");
    try {
      await compose(["up", "-d", "postgres", "redis"], { inherit: true });
      startedDocker = true;
      log("Ожидание PostgreSQL...");
      const ready = await waitForPostgres();
      if (!ready) warn("PostgreSQL не ответил вовремя — db push может упасть");
    } catch (e) {
      warn(`Docker недоступен или ошибка compose: ${e.message}`);
      warn("Продолжаем без Docker — нужен свой PostgreSQL в DATABASE_URL");
    }
  } else if (!noDocker) {
    warn("Docker не найден — убедись что PostgreSQL запущен и DATABASE_URL в .env верный");
  }

  ensureDevSecrets();

  log("\n==> pnpm install");
  await runInherit("pnpm", ["install"]);

  log("\n==> Схема БД (drizzle push)");
  try {
    await runInherit("pnpm", ["--filter", "@workspace/db", "run", "push"]);
  } catch {
    die(
      "\nОшибка db push. Проверь DATABASE_URL и что PostgreSQL запущен.\n" +
        "  Docker: pnpm infra\n" +
        "  Или свой Postgres: отредактируй .env и повтори pnpm setup",
    );
  }

  if (full) {
    log("\n==> Проверка типов (--full)");
    await runInherit("pnpm", ["run", "typecheck"]);
  }

  log("\n✓ Готово. Дальше:\n");
  log("  pnpm dev     — API :8080 + Web :5000");
  log("  pnpm smoke   — smoke-тест API (после dev)");
  if (!full) log("  pnpm setup:full — полная проверка типов");
  log("");
}

main().catch((e) => die(e.message ?? String(e)));
