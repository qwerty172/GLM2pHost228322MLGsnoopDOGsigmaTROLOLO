#!/usr/bin/env node
/**
 * Одноразовая локальная настройка: .env, секреты, install, db push.
 * Опционально: --full (typecheck), --docker-db (поднять Postgres в Docker).
 */
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCKER_PG_URL,
  ensureEnvFile,
  parseEnvFile,
  setEnvValue,
} from "./lib/env-file.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const full = args.has("--full");
const dockerDb = args.has("--docker-db");

function log(msg) {
  console.log(msg);
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
}

function generateHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function isUnset(val) {
  return !val || val.trim() === "";
}

function tryDockerPostgres() {
  try {
    execSync("docker compose version", { stdio: "ignore" });
  } catch {
    log("⚠ Docker не найден — пропускаем dev:db");
    return false;
  }
  log("==> Docker Postgres (infra/docker-compose.dev.yml)");
  run(
    "docker compose -f infra/docker-compose.dev.yml up postgres -d --wait",
  );
  return true;
}

function runPgProbe(url) {
  if (!url) return false;
  try {
    execSync(
      `node --input-type=module -e "import pg from 'pg';const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();await c.query('SELECT 1');await c.end();"`,
      {
        cwd: join(ROOT, "lib/db"),
        env: { ...process.env, DATABASE_URL: url },
        stdio: "ignore",
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  log("==> DecentralHub — setup (bootstrap)");

  const { created, path: envPath } = ensureEnvFile(ROOT);
  if (created) log("Создан .env из .env.example");

  let env = parseEnvFile(envPath);

  if (isUnset(env.WALLET_ENCRYPTION_KEY)) {
    setEnvValue(envPath, "WALLET_ENCRYPTION_KEY", generateHex(32));
    log("✓ WALLET_ENCRYPTION_KEY");
  }
  if (isUnset(env.JWT_SECRET)) {
    setEnvValue(envPath, "JWT_SECRET", generateHex(32));
    log("✓ JWT_SECRET");
  }
  if (isUnset(env.ADMIN_SECRET) || env.ADMIN_SECRET === "change-me-local-dev") {
    setEnvValue(envPath, "ADMIN_SECRET", "local-dev-admin");
    log("✓ ADMIN_SECRET (local-dev-admin)");
  }

  env = parseEnvFile(envPath);

  if (dockerDb) {
    tryDockerPostgres();
    setEnvValue(envPath, "DATABASE_URL", DOCKER_PG_URL);
    env = parseEnvFile(envPath);
  }

  if (isUnset(env.DATABASE_URL) || env.DATABASE_URL.includes("user:password")) {
    if (runPgProbe(DOCKER_PG_URL)) {
      setEnvValue(envPath, "DATABASE_URL", DOCKER_PG_URL);
      log("✓ DATABASE_URL → Docker Postgres");
      env = parseEnvFile(envPath);
    } else {
      log(
        "⚠ Настрой DATABASE_URL в .env (или: pnpm dev:db && pnpm setup --docker-db)",
      );
    }
  }

  log("==> pnpm install");
  run("pnpm install");

  if (env.DATABASE_URL && !env.DATABASE_URL.includes("user:password")) {
    log("==> db push");
    try {
      run("pnpm --filter @workspace/db run push");
      log("✓ Схема БД применена");
    } catch {
      log("⚠ db push не удался — проверь PostgreSQL и DATABASE_URL");
    }
  }

  if (full) {
    log("==> typecheck");
    run("pnpm run typecheck");
  }

  log("");
  log("Готово. Дальше:");
  log("  pnpm doctor   — проверка окружения");
  log("  pnpm dev      — API + Web");
  log("");
  log("Web:  http://localhost:5000");
  log("API:  http://localhost:8080/api/healthz");
  log("Демо: http://localhost:5000/games/rogue-fable-3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
