#!/usr/bin/env node
/**
 * Создаёт .env из .env.example и заполняет секреты для локальной разработки.
 * Использование: node scripts/setup-env.mjs [--docker]
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");
const useDocker = process.argv.includes("--docker");

const DOCKER_DATABASE_URL =
  "postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub";

function generateHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

function setLine(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }
  return `${content.trimEnd()}\n${key}=${value}\n`;
}

if (!existsSync(examplePath)) {
  console.error("Не найден .env.example");
  process.exit(1);
}

let content;
let created = false;

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  content = readFileSync(envPath, "utf8");
  created = true;
  console.log("Создан .env из .env.example");
} else {
  content = readFileSync(envPath, "utf8");
  console.log(".env уже существует — дополняем пустые поля");
}

if (useDocker) {
  content = setLine(content, "DATABASE_URL", DOCKER_DATABASE_URL);
  console.log("DATABASE_URL → Docker Postgres (decentral_hub:decentral_hub)");
} else if (/^DATABASE_URL=postgresql:\/\/user:password@/m.test(content)) {
  console.log(
    "Подсказка: для Docker Postgres запустите node scripts/setup-env.mjs --docker или pnpm setup",
  );
}

for (const [key, generator] of [
  ["WALLET_ENCRYPTION_KEY", () => generateHex(32)],
  ["JWT_SECRET", () => generateHex(32)],
]) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match || match[1].trim() === "") {
    content = setLine(content, key, generator());
    console.log(`Сгенерирован ${key}`);
  }
}

writeFileSync(envPath, content, "utf8");

console.log(
  created
    ? "\nГотово. Дальше: pnpm db:up (если Docker) → pnpm install → pnpm --filter @workspace/db run push"
    : "\nГотово.",
);
