#!/usr/bin/env node
/**
 * Диагностика окружения: что готово сразу, что опционально.
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./lib/env-file.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env");

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

function checkNode() {
  const major = Number(process.version.slice(1).split(".")[0]);
  if (major >= 20) ok(`Node ${process.version}`);
  else fail(`Node ${process.version} — нужен 20+`);
  return major >= 20;
}

async function checkFetch(url, label) {
  try {
    const res = await fetch(url);
    if (res.ok) {
      ok(label);
      return true;
    }
    warn(`${label} → HTTP ${res.status}`);
    return false;
  } catch {
    warn(`${label} — недоступен`);
    return false;
  }
}

async function checkPg(url) {
  if (!url) {
    fail("DATABASE_URL не задан");
    return false;
  }
  try {
    execSync(
      `node --input-type=module -e "import pg from 'pg';const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();await c.query('SELECT 1');await c.end();"`,
      {
        cwd: join(ROOT, "lib/db"),
        env: { ...process.env, DATABASE_URL: url },
        stdio: "ignore",
      },
    );
    ok("PostgreSQL подключение");
    return true;
  } catch {
    fail("PostgreSQL — не подключается (pnpm dev:db или настрой DATABASE_URL)");
    return false;
  }
}

function checkRedis(url) {
  if (!url) {
    warn("REDIS_URL не задан — in-memory (норм для локалки)");
    return true;
  }
  try {
    execSync(
      `node --input-type=module -e "import Redis from 'ioredis';const r=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:2000});await r.ping();r.disconnect();"`,
      {
        cwd: join(ROOT, "artifacts/api-server"),
        env: { ...process.env, REDIS_URL: url },
        stdio: "ignore",
      },
    );
    ok("Redis");
    return true;
  } catch {
    warn("Redis недоступен — API использует fallback");
    return true;
  }
}

async function main() {
  console.log("DecentralHub — doctor\n");

  const nodeOk = checkNode();

  if (!existsSync(envPath)) {
    fail(".env отсутствует → pnpm setup");
    console.log("\nБыстрый старт: pnpm dev:db && pnpm setup && pnpm dev");
    process.exit(1);
  }

  ok(".env существует");
  const env = parseEnvFile(envPath);

  const pgOk = await checkPg(env.DATABASE_URL);

  if (env.WALLET_ENCRYPTION_KEY) ok("WALLET_ENCRYPTION_KEY");
  else fail("WALLET_ENCRYPTION_KEY пуст → pnpm setup");

  if (env.JWT_SECRET) ok("JWT_SECRET");
  else warn("JWT_SECRET пуст → pnpm setup");

  await checkRedis(env.REDIS_URL);

  const apiPort = env.PORT || "8080";
  const webPort = env.WEB_PORT || "5000";
  const apiUp = await checkFetch(
    `http://localhost:${apiPort}/api/healthz`,
    `API :${apiPort}`,
  );
  await checkFetch(`http://localhost:${webPort}`, `Web :${webPort}`);

  console.log("\n--- Опционально (на потом) ---");
  if (env.TURN_SECRET || env.TURN_URL) ok("TURN настроен");
  else warn("TURN не настроен — WebRTC может не работать за NAT");
  if (env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) ok("Object Storage");
  else warn("Object Storage не настроен — загрузки деградируют");

  console.log("");
  if (!pgOk) {
    console.log("Следующий шаг: pnpm dev:db && pnpm setup --docker-db");
    process.exit(1);
  }
  if (!apiUp) {
    console.log("Следующий шаг: pnpm dev");
    process.exit(0);
  }
  console.log("Всё готово → http://localhost:" + webPort + "/games/rogue-fable-3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
