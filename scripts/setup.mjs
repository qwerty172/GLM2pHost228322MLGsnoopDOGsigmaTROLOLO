#!/usr/bin/env node
/**
 * Кроссплатформенная первичная настройка: .env, секреты, pnpm install, db push.
 * Опционально поднимает Postgres+Redis через Docker (pnpm deps:up).
 */
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");

function run(cmd, opts = {}) {
  console.log(`\n==> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
}

function hasDocker() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0;
}

function ensureEnv() {
  if (!existsSync(ENV_PATH)) {
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    console.log("Создан .env из .env.example");
  } else {
    console.log(".env уже существует");
  }

  let env = readFileSync(ENV_PATH, "utf8");
  let changed = false;

  const setIfEmpty = (key) => {
    const re = new RegExp(`^${key}=\\s*$`, "m");
    if (re.test(env)) {
      const value = randomBytes(32).toString("hex");
      env = env.replace(re, `${key}=${value}`);
      console.log(`Сгенерирован ${key}`);
      changed = true;
    }
  };

  setIfEmpty("WALLET_ENCRYPTION_KEY");
  setIfEmpty("JWT_SECRET");

  if (changed) {
    writeFileSync(ENV_PATH, env);
  }
}

function startDeps() {
  if (!hasDocker()) {
    console.log(
      "\nDocker не найден — пропускаем deps:up. Убедись, что PostgreSQL запущен вручную.",
    );
    return false;
  }

  console.log("\n==> Поднимаем Postgres + Redis (docker compose)...");
  run("docker compose -f infra/docker-compose.dev.yml up -d postgres redis");

  console.log("Ждём готовности Postgres...");
  for (let i = 0; i < 30; i++) {
    const r = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        "infra/docker-compose.dev.yml",
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "decentral_hub",
        "-d",
        "decentral_hub",
      ],
      { cwd: ROOT, stdio: "ignore" },
    );
    if (r.status === 0) {
      console.log("Postgres готов");
      return true;
    }
    execSync("sleep 1");
  }

  console.warn("Postgres не ответил за 30с — продолжаем, db push может упасть");
  return true;
}

console.log("==> DecentralHub — настройка");

ensureEnv();
startDeps();

run("pnpm install");
run("pnpm --filter @workspace/db run push");

console.log("\n✓ Готово. Запуск: pnpm dev");
console.log("  Web:  http://localhost:5000");
console.log("  API:  http://localhost:8080/api/healthz");
console.log("\nОпционально позже:");
console.log("  pnpm deps:up     — Postgres + Redis + coturn (WebRTC)");
console.log("  pnpm run typecheck — проверка типов (CI)");
console.log("  pnpm test        — тесты API");
