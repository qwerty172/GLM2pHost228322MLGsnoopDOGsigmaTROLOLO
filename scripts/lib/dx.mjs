/**
 * Общие утилиты для DX-скриптов (bootstrap, dev, smoke).
 */
import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ENV_EXAMPLE = join(ROOT, ".env.example");
export const ENV_FILE = join(ROOT, ".env");
export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

export const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

const PLACEHOLDER_DATABASE_URLS = new Set([
  "postgresql://user:password@localhost:5432/decentral_hub",
  "postgresql://postgres:password@localhost:5432/decentral_hub",
]);

export function log(msg) {
  console.log(msg);
}

export function warn(msg) {
  console.warn(`⚠ ${msg}`);
}

export function die(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

export function run(cmd, opts = {}) {
  execSync(cmd, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
    ...opts,
  });
}

export function hasDocker() {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function dockerCompose(args, { silent = false } = {}) {
  const cmd = `docker compose -f "${COMPOSE_FILE}" ${args}`;
  execSync(cmd, {
    cwd: ROOT,
    stdio: silent ? "ignore" : "inherit",
  });
}

export function readEnvFile() {
  if (!existsSync(ENV_FILE)) return null;
  return readFileSync(ENV_FILE, "utf8");
}

export function parseEnv(content) {
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    env[key] = value;
  }
  return env;
}

export function getEnvValue(key) {
  const content = readEnvFile();
  if (!content) return undefined;
  return parseEnv(content)[key];
}

export function setEnvValue(key, value) {
  let content = readEnvFile() ?? readFileSync(ENV_EXAMPLE, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, `${key}=${value}`);
  } else {
    content = `${content.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(ENV_FILE, content, "utf8");
}

export function ensureEnvFile() {
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE, "utf8"), "utf8");
    log("Создан .env из .env.example");
    return true;
  }
  log(".env уже существует");
  return false;
}

export function generateHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function ensureSecret(key) {
  const current = getEnvValue(key);
  if (current && current.trim()) return false;
  const value = generateHex(32);
  setEnvValue(key, value);
  log(`Сгенерирован ${key}`);
  return true;
}

export function ensureDockerDatabaseUrl() {
  const current = getEnvValue("DATABASE_URL")?.trim();
  if (!current || PLACEHOLDER_DATABASE_URLS.has(current)) {
    setEnvValue("DATABASE_URL", DOCKER_DATABASE_URL);
    log(`DATABASE_URL → docker (${DOCKER_DATABASE_URL})`);
    return true;
  }
  return false;
}

export function startInfra({ withCoturn = false } = {}) {
  if (!hasDocker()) {
    warn("Docker не найден — пропускаем infra (нужен свой PostgreSQL)");
    return false;
  }

  const services = withCoturn
    ? "postgres redis coturn"
    : "postgres redis";
  log(`==> Docker: ${services}`);
  dockerCompose(`up -d ${services}`);
  return true;
}

export function verifyDatabase() {
  const url = getEnvValue("DATABASE_URL") ?? DOCKER_DATABASE_URL;
  try {
    execSync(
      `node --input-type=module -e "import pg from 'pg'; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); await c.connect(); await c.end();"`,
      {
        cwd: join(ROOT, "lib/db"),
        env: { ...process.env, DATABASE_URL: url },
        stdio: "ignore",
      },
    );
    log("PostgreSQL подключён");
    return true;
  } catch {
    return false;
  }
}

export function waitForPostgres(timeoutMs = 60_000) {
  const url = getEnvValue("DATABASE_URL") ?? DOCKER_DATABASE_URL;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      execSync(`docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U decentral_hub`, {
        cwd: ROOT,
        stdio: "ignore",
      });
      log("PostgreSQL готов");
      return;
    } catch {
      // retry
    }

    // Fallback: try direct connection if not using docker postgres
    try {
      execSync(`psql "${url}" -c "SELECT 1"`, { stdio: "ignore" });
      log("PostgreSQL готов");
      return;
    } catch {
      // retry
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  die("PostgreSQL не ответил вовремя — проверь DATABASE_URL и что postgres запущен");
}

export function spawnDev(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[${name}] завершён сигналом ${signal}`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${name}] завершён с кодом ${code}`);
    }
  });
  return child;
}
