import { execSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ENV_PATH = join(ROOT, ".env");
export const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

export const DEFAULT_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

const PLACEHOLDER_DATABASE_URL =
  "postgresql://user:password@localhost:5432/decentral_hub";

export function log(message) {
  console.log(message);
}

export function warn(message) {
  console.warn(message);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function hasDocker() {
  if (!hasCommand("docker")) {
    return false;
  }

  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function readEnvFile() {
  if (!existsSync(ENV_PATH)) {
    return "";
  }
  return readFileSync(ENV_PATH, "utf8");
}

export function getEnvValue(key, source = readEnvFile()) {
  const match = source.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) {
    return undefined;
  }
  return match[1].trim();
}

export function setEnvValue(key, value, source = readEnvFile()) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(source)) {
    return source.replace(pattern, line);
  }

  const suffix = source.endsWith("\n") || source.length === 0 ? "" : "\n";
  return `${source}${suffix}${line}\n`;
}

export function writeEnvFile(content) {
  writeFileSync(ENV_PATH, content.endsWith("\n") ? content : `${content}\n`, "utf8");
}

export function ensureEnvFile() {
  if (existsSync(ENV_PATH)) {
    return false;
  }

  if (!existsSync(ENV_EXAMPLE_PATH)) {
    throw new Error("Не найден .env.example");
  }

  copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  log("Создан .env из .env.example");
  return true;
}

export function ensureDevSecrets() {
  let env = readEnvFile();
  let changed = false;

  const databaseUrl = getEnvValue("DATABASE_URL", env);
  if (!databaseUrl || databaseUrl === PLACEHOLDER_DATABASE_URL) {
    env = setEnvValue("DATABASE_URL", DEFAULT_DATABASE_URL, env);
    changed = true;
    log(`DATABASE_URL → ${DEFAULT_DATABASE_URL}`);
  }

  for (const key of ["JWT_SECRET", "WALLET_ENCRYPTION_KEY"]) {
    const current = getEnvValue(key, env);
    if (!current) {
      const generated = randomBytes(32).toString("hex");
      env = setEnvValue(key, generated, env);
      changed = true;
      log(`Сгенерирован ${key}`);
    }
  }

  const adminSecret = getEnvValue("ADMIN_SECRET", env);
  if (!adminSecret || adminSecret === "change-me-local-dev") {
    const generated = randomBytes(16).toString("hex");
    env = setEnvValue("ADMIN_SECRET", generated, env);
    changed = true;
    log("Сгенерирован ADMIN_SECRET");
  }

  if (changed) {
    writeEnvFile(env);
  }

  return env;
}

export function dockerCompose(args, options = {}) {
  const command = `docker compose -f "${COMPOSE_FILE}" ${args}`;
  execSync(command, {
    cwd: ROOT,
    stdio: options.stdio ?? "inherit",
  });
}

export async function startInfra(services = ["postgres", "redis"]) {
  if (!hasDocker()) {
    warn("Docker недоступен — пропускаем infra (нужен свой PostgreSQL).");
    return false;
  }

  log(`==> Docker: ${services.join(", ")}`);
  dockerCompose(`up -d ${services.join(" ")}`);

  if (services.includes("postgres")) {
    await waitForPostgres();
  }

  return true;
}

export async function waitForPostgres(maxAttempts = 30) {
  if (!hasDocker()) {
    return false;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      execSync(
        `docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U decentral_hub -d decentral_hub`,
        { stdio: "ignore", cwd: ROOT },
      );
      log("PostgreSQL готов");
      return true;
    } catch {
      if (attempt === maxAttempts) {
        warn("PostgreSQL не ответил вовремя — проверь docker compose logs postgres");
        return false;
      }
      await sleep(1000);
    }
  }

  return false;
}

export function runPnpm(args, options = {}) {
  execSync(`pnpm ${args.join(" ")}`, {
    cwd: ROOT,
    stdio: options.stdio ?? "inherit",
    env: { ...process.env, ...options.env },
  });
}

export function spawnPnpm(args, options = {}) {
  const child = spawn("pnpm", args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
    shell: process.platform === "win32",
  });

  return child;
}

export function loadEnvIntoProcess() {
  if (!existsSync(ENV_PATH)) {
    return;
  }

  const content = readEnvFile();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function verifyDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    return false;
  }

  const scriptPath = join(ROOT, "lib/db/scripts/verify.mjs");

  try {
    execSync(`node "${scriptPath}"`, {
      cwd: join(ROOT, "lib/db"),
      stdio: "ignore",
      env: { ...process.env, DATABASE_URL: connectionString },
    });
    return true;
  } catch {
    return false;
  }
}
