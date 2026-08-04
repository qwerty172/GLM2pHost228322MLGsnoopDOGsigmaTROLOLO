/**
 * Общие утилиты для DX-скриптов (bootstrap, dev, smoke, infra).
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export const DEFAULT_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

const SECRET_KEYS = ["JWT_SECRET", "WALLET_ENCRYPTION_KEY", "ADMIN_SECRET"];

export function log(msg) {
  console.log(msg);
}

export function warn(msg) {
  console.warn(`⚠ ${msg}`);
}

export function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

export function fileExists(rel) {
  return existsSync(join(ROOT, rel));
}

export function readEnvFile() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

export function writeEnvFile(entries) {
  const path = join(ROOT, ".env");
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}`);
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

/** Merge key=value updates into .env, preserving comments and unknown keys. */
export function patchEnv(updates) {
  const path = join(ROOT, ".env");
  const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = raw.length ? raw.split("\n") : [];
  const seen = new Set();

  const patched = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq);
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) patched.push(`${key}=${value}`);
  }

  writeFileSync(path, `${patched.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function run(cmd, args = [], opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    die(`Команда завершилась с кодом ${result.status ?? 1}: ${cmd} ${args.join(" ")}`);
  }
  return result;
}

export function runCapture(cmd, args = [], opts = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });
}

export function hasDocker() {
  const r = runCapture("docker", ["info"], { stdio: "pipe" });
  return r.status === 0;
}

export function dockerCompose(services, { detach = true } = {}) {
  const args = ["compose", "-f", COMPOSE_FILE, "up"];
  if (detach) args.push("-d");
  args.push(...services);
  run("docker", args);
}

export function ensureEnvFile() {
  const envPath = join(ROOT, ".env");
  const examplePath = join(ROOT, ".env.example");
  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) die("Нет .env.example — невозможно создать .env");
    copyFileSync(examplePath, envPath);
    log("✓ Создан .env из .env.example");
    return true;
  }
  log("✓ .env уже существует");
  return false;
}

export function ensureSecrets() {
  const env = readEnvFile();
  const updates = {};

  for (const key of SECRET_KEYS) {
    const value = env[key] ?? "";
    if (!value || value === "change-me-local-dev") {
      updates[key] = key === "ADMIN_SECRET" ? randomHex(16) : randomHex(32);
    }
  }

  const dbUrl = env.DATABASE_URL ?? "";
  if (
    !dbUrl ||
    dbUrl === "postgresql://user:password@localhost:5432/decentral_hub"
  ) {
    updates.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  if (Object.keys(updates).length > 0) {
    patchEnv(updates);
    const keys = Object.keys(updates).join(", ");
    log(`✓ Заполнены значения по умолчанию: ${keys}`);
  }
}

export async function waitForTcp(host, port, { timeoutMs = 60_000, label = "" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { connect } = await import("node:net");
      await new Promise((resolve, reject) => {
        const socket = connect({ host, port }, () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
        socket.setTimeout(2000, () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
      });
      return;
    } catch {
      await sleep(1000);
    }
  }
  die(`Таймаут ожидания ${label || `${host}:${port}`} (${timeoutMs / 1000}с)`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) flags.add(arg);
    else positional.push(arg);
  }
  return { flags, positional };
}
