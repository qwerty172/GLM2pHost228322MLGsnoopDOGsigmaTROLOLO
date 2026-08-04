/**
 * Общие утилиты для bootstrap/dev-скриптов monorepo.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ENV_PATH = join(ROOT, ".env");
export const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

/** DATABASE_URL по умолчанию — совпадает с infra/docker-compose.dev.yml */
export const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

export function log(msg) {
  console.log(msg);
}

export function warn(msg) {
  console.warn(msg);
}

export function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

export function readEnvFile(path = ENV_PATH) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function writeEnvFile(entries, path = ENV_PATH) {
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

/** Обновляет или добавляет ключ в .env, сохраняя комментарии и порядок строк. */
export function setEnvValue(key, value, path = ENV_PATH) {
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  const next = re.test(text)
    ? text.replace(re, line)
    : `${text.trimEnd()}\n${line}\n`;
  writeFileSync(path, next.endsWith("\n") ? next : `${next}\n`, "utf8");
}

export function getEnvValue(key, path = ENV_PATH) {
  return readEnvFile(path)[key] ?? "";
}

export function generateSecret(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hasDocker() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0;
}

export function dockerCompose(args, { quiet = false } = {}) {
  const base = ["compose", "-f", COMPOSE_FILE, ...args];
  const r = spawnSync("docker", base, {
    cwd: ROOT,
    stdio: quiet ? "ignore" : "inherit",
  });
  return r.status === 0;
}

export function waitForPostgres(databaseUrl, { timeoutMs = 60_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = spawnSync(
      "pnpm",
      ["--filter", "@workspace/db", "run", "verify"],
      {
        cwd: ROOT,
        stdio: "ignore",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      },
    );
    if (r.status === 0) return true;
    spawnSync("sleep", ["1"]);
  }
  return false;
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    ...opts,
  });
  if (r.status !== 0) {
    die(`Команда завершилась с ошибкой: ${cmd} ${args.join(" ")}`, r.status ?? 1);
  }
}

export function spawnLogged(label, cmd, args, env = process.env) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${label}] `;
  child.stdout?.on("data", (d) => process.stdout.write(`${prefix}${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`${prefix}${d}`));
  return child;
}

export function isPlaceholderSecret(value) {
  if (!value) return true;
  const v = value.trim();
  return (
    v === "" ||
    v === "change-me-local-dev" ||
    v === "user:password" ||
    v.includes("ВАШ_ПАРОЛЬ")
  );
}

export function isDefaultDatabaseUrl(value) {
  if (!value) return true;
  return (
    value.includes("user:password@") ||
    value.includes("postgres:ВАШ_ПАРОЛЬ")
  );
}
