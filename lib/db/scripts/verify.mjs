#!/usr/bin/env node
/**
 * Проверка подключения к PostgreSQL (используется после db push).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = join(ROOT, ".env");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(envPath)) {
    console.error("Нет DATABASE_URL и .env");
    process.exit(1);
  }
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  const url = line?.slice("DATABASE_URL=".length).trim();
  if (!url) {
    console.error("DATABASE_URL пустой в .env");
    process.exit(1);
  }
  return url;
}

const client = new pg.Client({ connectionString: databaseUrl() });

try {
  await client.connect();
  const res = await client.query("SELECT 1 AS ok");
  if (res.rows[0]?.ok !== 1) {
    console.error("Неожиданный ответ БД");
    process.exit(1);
  }
  console.log("✓ PostgreSQL доступен");
} catch (err) {
  console.error("✗ PostgreSQL недоступен:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
