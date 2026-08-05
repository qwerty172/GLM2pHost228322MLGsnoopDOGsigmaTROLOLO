#!/usr/bin/env node
/**
 * Создаёт .env из .env.example и заполняет пустые секреты / docker-дефолты.
 * Используется в setup-local.* — не требует ручного редактирования для локалки.
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env");
const EXAMPLE_PATH = resolve(ROOT, ".env.example");

const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";
const DOCKER_REDIS_URL = "redis://localhost:6379";

function hex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function parseEnv(text) {
  const lines = text.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return { lines, map };
}

function serializeEnv(lines, map) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && map.has(m[1])) {
      out.push(`${m[1]}=${map.get(m[1])}`);
      seen.add(m[1]);
    } else {
      out.push(line);
    }
  }
  for (const [key, value] of map) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }
  return out.join("\n") + "\n";
}

function isEmpty(value) {
  return value === undefined || value === "";
}

function setIfEmpty(map, key, value) {
  if (isEmpty(map.get(key))) {
    map.set(key, value);
    return true;
  }
  return false;
}

const useDocker = process.argv.includes("--docker");

if (!existsSync(ENV_PATH)) {
  if (!existsSync(EXAMPLE_PATH)) {
    console.error("Нет .env.example — невозможно создать .env");
    process.exit(1);
  }
  copyFileSync(EXAMPLE_PATH, ENV_PATH);
  console.log("Создан .env из .env.example");
}

let text = readFileSync(ENV_PATH, "utf8");
const { lines, map } = parseEnv(text);
const changes = [];

if (useDocker) {
  if (setIfEmpty(map, "DATABASE_URL", DOCKER_DATABASE_URL)) {
    changes.push("DATABASE_URL → docker postgres");
  }
  if (setIfEmpty(map, "REDIS_URL", DOCKER_REDIS_URL)) {
    changes.push("REDIS_URL → docker redis");
  }
}

if (setIfEmpty(map, "WALLET_ENCRYPTION_KEY", hex(32))) {
  changes.push("WALLET_ENCRYPTION_KEY");
}
if (setIfEmpty(map, "JWT_SECRET", hex(32))) {
  changes.push("JWT_SECRET");
}
if (setIfEmpty(map, "ADMIN_SECRET", `local-dev-${hex(8)}`)) {
  changes.push("ADMIN_SECRET");
}

if (changes.length > 0) {
  writeFileSync(ENV_PATH, serializeEnv(lines, map));
  console.log("Автозаполнено:", changes.join(", "));
} else {
  console.log(".env уже настроен — изменений нет");
}
