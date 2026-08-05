#!/usr/bin/env node
/**
 * Ждёт готовности PostgreSQL (для pnpm setup после docker compose up).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadDatabaseUrl() {
  if (!existsSync(envPath)) return null;
  const match = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

const databaseUrl = process.env.DATABASE_URL ?? loadDatabaseUrl();
if (!databaseUrl) {
  console.log("DATABASE_URL не задан — пропускаем ожидание Postgres");
  process.exit(0);
}

const maxAttempts = 30;
const delayMs = 1000;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const result = spawnSync(
    "docker",
    ["compose", "-f", "infra/docker-compose.dev.yml", "exec", "-T", "postgres", "pg_isready", "-U", "decentral_hub"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status === 0) {
    console.log("PostgreSQL готов");
    process.exit(0);
  }
  if (attempt < maxAttempts) {
    process.stdout.write(`Ожидание Postgres… (${attempt}/${maxAttempts})\r`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

console.error("\nPostgreSQL не ответил вовремя. Запустите: pnpm db:up");
process.exit(1);
