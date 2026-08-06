#!/usr/bin/env node
/**
 * Единая первичная настройка: .env, секреты, Docker Postgres/Redis, схема БД.
 * Запуск: pnpm setup
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile, upsertEnvFile, randomHex } from "./lib/env-file.mjs";
import {
  hasDocker,
  hasComposeFile,
  dockerComposeUp,
  waitForPostgres,
} from "./lib/docker.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...opts,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function isPlaceholderDatabaseUrl(url) {
  if (!url) return true;
  return (
    url.includes("user:password@") ||
    url === "postgresql://localhost:5432/decentral_hub" ||
    url === "postgresql://user:password@localhost:5432/decentral_hub"
  );
}

/** @param {string} databaseUrl @param {number} timeoutMs */
async function canConnectPostgres(databaseUrl, timeoutMs = 5_000) {
  let host = "localhost";
  let port = 5432;
  try {
    const url = new URL(databaseUrl.replace(/^postgresql:/, "http:"));
    host = url.hostname || host;
    port = Number(url.port || port);
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

async function main() {
  console.log("==> DecentralHub — быстрая настройка\n");

  if (!existsSync(ENV_FILE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log("Создан .env из .env.example");
  } else {
    console.log(".env уже есть — дополним только пустые поля");
  }

  const env = readEnvFile(ENV_FILE);
  const updates = {};

  if (!env.WALLET_ENCRYPTION_KEY) {
    updates.WALLET_ENCRYPTION_KEY = randomHex(32);
    console.log("Сгенерирован WALLET_ENCRYPTION_KEY");
  }

  if (!env.JWT_SECRET) {
    updates.JWT_SECRET = randomHex(32);
    console.log("Сгенерирован JWT_SECRET");
  }

  if (!env.ADMIN_SECRET || env.ADMIN_SECRET === "change-me-local-dev") {
    // Оставляем дефолт для локалки — не перезаписываем, если пользователь уже поменял.
  }

  let usedDocker = false;
  if (hasDocker() && hasComposeFile()) {
    console.log("\n==> Docker: postgres + redis");
    if (dockerComposeUp(["postgres", "redis"])) {
      usedDocker = true;
      process.stdout.write("Ожидание PostgreSQL");
      const ready = await waitForPostgres();
      console.log(ready ? " — готов" : " — таймаут (продолжаем)");
      if (isPlaceholderDatabaseUrl(env.DATABASE_URL)) {
        updates.DATABASE_URL = DOCKER_DATABASE_URL;
        console.log("DATABASE_URL → Docker Compose (decentral_hub/decentral_hub)");
      }
    } else {
      console.warn("Не удалось поднять Docker Compose — проверь DATABASE_URL вручную");
    }
  } else if (isPlaceholderDatabaseUrl(env.DATABASE_URL)) {
    console.log(
      "\nDocker не найден — укажи DATABASE_URL в .env (см. .env.example)",
    );
    console.log("  createdb decentral_hub");
    console.log("  DATABASE_URL=postgresql://USER:PASS@localhost:5432/decentral_hub");
  }

  if (Object.keys(updates).length > 0) {
    upsertEnvFile(ENV_FILE, updates);
  }

  console.log("\n==> pnpm install");
  run("pnpm", ["install"]);

  console.log("\n==> Схема БД (drizzle push)");
  const mergedEnv = { ...process.env, ...readEnvFile(ENV_FILE), ...updates };
  const databaseUrl = mergedEnv.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\nDATABASE_URL не задан в .env");
    process.exit(1);
  }

  if (!(await canConnectPostgres(databaseUrl))) {
    console.error("\nPostgreSQL недоступен по DATABASE_URL.");
    if (!usedDocker) {
      console.error("Подсказка: установи Docker и снова запусти pnpm setup");
      console.error("  или запусти свой PostgreSQL и проверь DATABASE_URL");
    }
    process.exit(1);
  }

  const push = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push"], {
    cwd: ROOT,
    stdio: "inherit",
    env: mergedEnv,
  });
  if (push.status !== 0) {
    console.error("\nОшибка db push — проверь лог выше.");
    process.exit(push.status ?? 1);
  }

  console.log("\n✓ Готово. Следующий шаг:\n");
  console.log("  pnpm dev\n");
  console.log("Откроется:");
  console.log("  Web   http://localhost:5000");
  console.log("  API   http://localhost:8080/api/healthz");
  console.log("\nДемо без Windows-агента: http://localhost:5000/games/rogue-fable-3");
  console.log("Продвинутое (TURN, coturn, object storage) — см. .env.example");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
