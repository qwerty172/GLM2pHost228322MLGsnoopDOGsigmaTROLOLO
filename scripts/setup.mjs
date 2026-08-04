#!/usr/bin/env node
/**
 * Первичная настройка: .env, секреты, Docker (postgres+redis), install, db push.
 * Быстрый путь: node scripts/setup.mjs
 * С проверкой типов: node scripts/setup.mjs --typecheck
 */
import { execSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");
const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");
const DOCKER_DB_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";
const PLACEHOLDER_DB_URLS = new Set([
  "postgresql://user:password@localhost:5432/decentral_hub",
  "",
]);

const withTypecheck = process.argv.includes("--typecheck");

function log(msg) {
  console.log(msg);
}

function run(cmd, opts = {}) {
  log(`\n==> ${cmd}`);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: ROOT,
    stdio: "inherit",
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function hasDocker() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1] : "";
}

function setEnvValue(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, `${key}=${value}`);
  }
  return `${content.replace(/\n?$/, "\n")}${key}=${value}\n`;
}

function ensureEnvFile() {
  if (!existsSync(ENV_PATH)) {
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    log("Создан .env из .env.example");
  } else {
    log(".env уже существует");
  }
}

function ensureSecrets() {
  let content = readFileSync(ENV_PATH, "utf8");

  for (const key of ["WALLET_ENCRYPTION_KEY", "JWT_SECRET"]) {
    const current = getEnvValue(content, key);
    if (!current) {
      const generated = crypto.randomBytes(32).toString("hex");
      content = setEnvValue(content, key, generated);
      log(`Сгенерирован ${key}`);
    }
  }

  writeFileSync(ENV_PATH, content);
}

function ensureDatabaseUrl(useDocker) {
  let content = readFileSync(ENV_PATH, "utf8");
  const current = getEnvValue(content, "DATABASE_URL");

  if (useDocker && PLACEHOLDER_DB_URLS.has(current)) {
    content = setEnvValue(content, "DATABASE_URL", DOCKER_DB_URL);
    writeFileSync(ENV_PATH, content);
    log(`DATABASE_URL → Docker (${DOCKER_DB_URL})`);
  } else if (!current) {
    log(
      "DATABASE_URL пуст — укажи строку подключения в .env или установи Docker для автонастройки",
    );
  }
}

async function startDockerInfra() {
  if (!hasDocker()) {
    log(
      "Docker не найден — пропускаем postgres/redis (нужен свой PostgreSQL и DATABASE_URL в .env)",
    );
    return false;
  }

  run(`docker compose -f "${COMPOSE_FILE}" up -d postgres redis`);

  log("Ожидание PostgreSQL...");
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const probe = spawnSync(
      `docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U decentral_hub`,
      { shell: true, cwd: ROOT, stdio: "ignore" },
    );
    if (probe.status === 0) {
      log("PostgreSQL готов");
      return true;
    }
    await sleep(1000);
  }

  console.error("PostgreSQL не ответил за 60с — проверь docker compose logs");
  process.exit(1);
}

async function main() {
  log("==> DecentralHub — настройка (pnpm setup)");

  ensureEnvFile();
  const dockerOk = await startDockerInfra();
  ensureSecrets();
  ensureDatabaseUrl(dockerOk);

  run("pnpm install");
  run("pnpm --filter @workspace/db run push");

  if (withTypecheck) {
    run("pnpm run typecheck");
  } else {
    log("\nПроверка типов пропущена (быстрый режим). На потом: pnpm setup:full");
  }

  log("\n✓ Готово. Запуск: pnpm dev");
  log("  API:  http://localhost:8080/api/healthz");
  log("  Web:  http://localhost:5000");
  log("  Проверка: pnpm smoke");
  log("\nНа потом:");
  log("  pnpm infra:full  — coturn (WebRTC/TURN)");
  log("  pnpm typecheck   — проверка типов");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
