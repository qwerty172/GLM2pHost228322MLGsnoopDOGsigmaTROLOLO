#!/usr/bin/env node
/**
 * Быстрая локальная настройка — без typecheck (см. pnpm setup:full).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { probePostgres } from "./lib/pg-probe.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

/**
 * @param {string} cmd
 * @param {string[]} args
 */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readEnvValue(content, key) {
  return content.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
}

function ensureEnv() {
  const envPath = join(ROOT, ".env");
  const examplePath = join(ROOT, ".env.example");

  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    console.log("Создан .env из .env.example");
  }

  let content = readFileSync(envPath, "utf8");
  let changed = false;

  /**
   * @param {string} key
   * @param {() => string} generator
   */
  const ensureKey = (key, generator) => {
    const emptyRe = new RegExp(`^${key}=\\s*$`, "m");
    const missingRe = new RegExp(`^${key}=`, "m");
    if (emptyRe.test(content)) {
      content = content.replace(emptyRe, `${key}=${generator()}`);
      changed = true;
      console.log(`Сгенерирован ${key}`);
    } else if (!missingRe.test(content)) {
      content += `\n${key}=${generator()}\n`;
      changed = true;
      console.log(`Добавлен ${key}`);
    }
  };

  ensureKey("WALLET_ENCRYPTION_KEY", () => randomBytes(32).toString("hex"));
  ensureKey("JWT_SECRET", () => randomBytes(32).toString("hex"));

  if (changed) writeFileSync(envPath, content);
  return readFileSync(envPath, "utf8");
}

console.log("==> DecentralHub — быстрая настройка\n");
const envContent = ensureEnv();

console.log("\n==> pnpm install");
run("pnpm", ["install"]);

const databaseUrl = readEnvValue(envContent, "DATABASE_URL");
if (databaseUrl && (await probePostgres(databaseUrl))) {
  console.log("\n==> Применение схемы БД");
  run("pnpm", ["--filter", "@workspace/db", "run", "push"]);
} else {
  console.log("\n⚠ PostgreSQL недоступен — пропускаем db push");
  console.log("  Запустите: pnpm dev:db");
  console.log("  Затем снова: pnpm setup");
}

console.log("\n✓ Готово. Запуск: pnpm dev");
console.log("  Подробнее: QUICKSTART.md\n");
