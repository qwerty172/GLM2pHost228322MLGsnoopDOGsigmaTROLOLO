/**
 * Shared helpers for cross-platform dev scripts (setup, dev, smoke, infra).
 */
import { randomBytes } from "node:crypto";
import { spawn, execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ENV_FILE = join(ROOT, ".env");
export const ENV_EXAMPLE = join(ROOT, ".env.example");
export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.dev.yml");

export const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

const PLACEHOLDER_DB =
  /postgresql:\/\/user:password@|postgresql:\/\/postgres:postgres@localhost/i;

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

export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function commandExists(cmd) {
  try {
    const check = process.platform === "win32" ? "where" : "command -v";
    execSync(`${check} ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function readEnvFile(path = ENV_FILE) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function writeEnvFile(entries, path = ENV_FILE) {
  const lines = readFileSync(path, "utf8").split("\n");
  const keys = new Set(Object.keys(entries));
  const out = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq);
    if (!keys.has(key)) return line;
    const val = entries[key];
    delete entries[key];
    return `${key}=${val}`;
  });
  for (const [key, val] of Object.entries(entries)) {
    out.push(`${key}=${val}`);
  }
  writeFileSync(path, out.join("\n"));
}

export function ensureEnvFile() {
  if (!existsSync(ENV_FILE)) {
    if (!existsSync(ENV_EXAMPLE)) die("Нет .env.example — не могу создать .env");
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    log("Создан .env из .env.example");
    return true;
  }
  return false;
}

/** Fill empty secrets and sensible DATABASE_URL when still a placeholder. */
export function ensureDevSecrets() {
  const updates = {};
  const env = readEnvFile();

  if (!env.WALLET_ENCRYPTION_KEY?.trim()) {
    updates.WALLET_ENCRYPTION_KEY = randomHex(32);
    log("Сгенерирован WALLET_ENCRYPTION_KEY");
  }
  if (!env.JWT_SECRET?.trim()) {
    updates.JWT_SECRET = randomHex(32);
    log("Сгенерирован JWT_SECRET");
  }

  const db = env.DATABASE_URL?.trim() ?? "";
  if (!db || PLACEHOLDER_DB.test(db) || db.includes("user:password")) {
    updates.DATABASE_URL = DOCKER_DATABASE_URL;
    log("DATABASE_URL → postgresql://decentral_hub:***@localhost:5432/decentral_hub");
  }

  if (Object.keys(updates).length > 0) writeEnvFile(updates);
  return updates;
}

export function dockerAvailable() {
  return commandExists("docker");
}

export function compose(args, { inherit = false } = {}) {
  const cmd = ["compose", "-f", COMPOSE_FILE, ...args];
  return run("docker", cmd, { inherit });
}

export async function waitForPostgres(url, { timeoutMs = 60_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      execSync(`docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U decentral_hub`, {
        stdio: "ignore",
        cwd: ROOT,
      });
      return true;
    } catch {
      await sleep(1500);
    }
  }
  return false;
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function run(cmd, args, { cwd = ROOT, inherit = false, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: inherit ? "inherit" : "pipe",
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    if (!inherit) {
      child.stdout?.on("data", (d) => {
        stdout += d;
      });
      child.stderr?.on("data", (d) => {
        stderr += d;
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          Object.assign(new Error(`${cmd} ${args.join(" ")} → exit ${code}`), {
            code,
            stdout,
            stderr,
          }),
        );
    });
  });
}

export function runInherit(cmd, args, opts) {
  return run(cmd, args, { ...opts, inherit: true });
}

export async function waitForHttp(url, { timeoutMs = 90_000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await sleep(intervalMs);
  }
  return false;
}
