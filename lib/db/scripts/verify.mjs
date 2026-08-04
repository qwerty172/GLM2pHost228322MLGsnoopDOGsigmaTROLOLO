/**
 * Проверка подключения к PostgreSQL после db push.
 * Использование: node lib/db/scripts/verify.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) {
    console.error("DATABASE_URL не задан и .env не найден");
    process.exit(1);
  }
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) {
    console.error("DATABASE_URL не найден в .env");
    process.exit(1);
  }
  return line.slice("DATABASE_URL=".length);
}

const url = databaseUrl();
const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query("SELECT 1 AS ok");
  console.log("✓ PostgreSQL доступен");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`✗ PostgreSQL недоступен: ${msg}`);
  console.error("  Проверь DATABASE_URL в .env и что PostgreSQL запущен.");
  console.error("  Быстрый вариант: pnpm infra  (Docker postgres+redis)");
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
