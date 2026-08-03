#!/usr/bin/env node
/**
 * Первичная настройка: .env, Docker (postgres+redis), pnpm install, db push.
 * Usage: node scripts/setup.mjs [--full]
 *   --full  также запустить pnpm typecheck (медленнее, на потом)
 */
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";
const PLACEHOLDER_DB =
  "postgresql://user:password@localhost:5432/decentral_hub";

const full = process.argv.includes("--full");

function log(msg) {
  console.log(msg);
}

function genHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function readEnvFile() {
  if (!existsSync(ENV_PATH)) return "";
  return readFileSync(ENV_PATH, "utf8");
}

function getEnvValue(content, key) {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = content.match(re);
  return m ? m[1].trim() : "";
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, line);
  return `${content.replace(/\s*$/, "")}\n${line}\n`;
}

function hasDocker() {
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function dockerUp() {
  log("==> Docker: postgres + redis");
  execSync(`docker compose -f "${COMPOSE_FILE}" up -d postgres redis`, {
    cwd: ROOT,
    stdio: "inherit",
  });
}

function waitForPort(host, port, timeoutMs = 90_000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = createConnection({ host, port });
      socket.setTimeout(2000);
      socket.on("connect", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Таймаут ожидания ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 1000);
      });
      socket.on("timeout", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Таймаут ожидания ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 1000);
      });
    };
    tryConnect();
  });
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

log("==> DecentralHub — настройка (взял и юзаешь)\n");

let env = readEnvFile();
if (!env) {
  if (!existsSync(ENV_EXAMPLE)) {
    console.error("Нет .env.example");
    process.exit(1);
  }
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  env = readEnvFile();
  log("Создан .env из .env.example");
}

const dbUrl = getEnvValue(env, "DATABASE_URL");
if (!dbUrl || dbUrl === PLACEHOLDER_DB) {
  env = setEnvValue(env, "DATABASE_URL", DOCKER_DATABASE_URL);
  log("DATABASE_URL → docker-compose (decentral_hub/decentral_hub)");
}

if (!getEnvValue(env, "WALLET_ENCRYPTION_KEY")) {
  env = setEnvValue(env, "WALLET_ENCRYPTION_KEY", genHex(32));
  log("Сгенерирован WALLET_ENCRYPTION_KEY");
}

if (!getEnvValue(env, "JWT_SECRET")) {
  env = setEnvValue(env, "JWT_SECRET", genHex(32));
  log("Сгенерирован JWT_SECRET");
}

if (!getEnvValue(env, "REDIS_URL")) {
  env = setEnvValue(env, "REDIS_URL", "redis://localhost:6379");
}

writeFileSync(ENV_PATH, env, "utf8");

if (hasDocker()) {
  dockerUp();
  log("Ожидание PostgreSQL…");
  await waitForPort("127.0.0.1", 5432);
  log("PostgreSQL готов");
} else {
  log(
    "Docker не найден — пропускаем контейнеры. Нужен свой PostgreSQL и DATABASE_URL в .env",
  );
}

log("\n==> pnpm install");
run("pnpm", ["install"]);

log("\n==> Схема БД (drizzle push)");
run("pnpm", ["--filter", "@workspace/db", "run", "push"]);

if (full) {
  log("\n==> Проверка типов (--full)");
  run("pnpm", ["run", "typecheck"]);
}

log(`
Готово.

  pnpm dev     — API :8080 + Web :5000
  pnpm smoke   — быстрая проверка API
  pnpm typecheck — типы (на потом)

Web:  http://localhost:5000
API:  http://localhost:8080/api/healthz
`);
