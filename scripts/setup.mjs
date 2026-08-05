#!/usr/bin/env node
/**
 * Быстрая первичная настройка: .env, секреты, pnpm install, db push (если PG доступен).
 * typecheck — только в setup:full.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const fullSetup = process.argv.includes("--full");

function log(msg) {
  console.log(msg);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureEnv() {
  const envPath = resolve(root, ".env");
  const examplePath = resolve(root, ".env.example");

  if (!existsSync(envPath)) {
    copyFileSync(examplePath, envPath);
    log("✓ Создан .env из .env.example");
  } else {
    log("· .env уже есть");
  }

  let content = readFileSync(envPath, "utf8");
  let changed = false;

  const setIfEmpty = (key, value) => {
    const emptyRe = new RegExp(`^${key}=\\s*$`, "m");
    if (emptyRe.test(content)) {
      content = content.replace(emptyRe, `${key}=${value}`);
      changed = true;
      log(`✓ Сгенерирован ${key}`);
    }
  };

  setIfEmpty("WALLET_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
  setIfEmpty("JWT_SECRET", randomBytes(32).toString("hex"));

  if (!/^DATABASE_URL=.+$/m.test(content) || /^DATABASE_URL=\s*$/m.test(content)) {
    content = content.replace(
      /^DATABASE_URL=.*$/m,
      "DATABASE_URL=postgresql://decentral_hub:decentral_hub@localhost:5432/decentral_hub",
    );
    changed = true;
    log("✓ DATABASE_URL → docker-compose (decentral_hub:decentral_hub@localhost:5432)");
  }

  if (changed) {
    writeFileSync(envPath, content, "utf8");
  }
}

function probePostgres() {
  const result = spawnSync("node", [resolve(__dirname, "pg-probe.mjs")], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
  });
  return result.status === 0;
}

log("==> DecentralHub — быстрая настройка\n");
ensureEnv();

log("\n==> pnpm install");
run("pnpm", ["install"]);

log("\n==> Схема БД");
if (probePostgres()) {
  run("pnpm", ["--filter", "@workspace/db", "run", "push"]);
  log("✓ Схема применена");
} else {
  log("⚠ PostgreSQL недоступен — пропускаем db push");
  log("  Запусти БД:  pnpm dev:db");
  log("  Затем:       pnpm bootstrap");
}

if (fullSetup) {
  log("\n==> Проверка типов");
  run("pnpm", ["run", "typecheck"]);
}

log("\nГотово! Запуск:");
log("  pnpm dev          — API + Web");
log("  pnpm dev:db       — только PostgreSQL (Docker)");
log("  pnpm dev:infra    — Postgres + Redis + coturn");
log("\nДемо в браузере: http://localhost:5000 → «Демо без Windows»");
