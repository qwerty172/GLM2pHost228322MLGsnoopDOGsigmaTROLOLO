/**
 * Run a single SQL statement via node-pg (Windows-friendly; no psql URI quirks).
 * Usage: node scripts/sql-query.mjs "SELECT 1"
 * Prints first column of first row (or empty).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "lib/db/package.json"));
const pg = require("pg");
const { Client } = pg;

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: node scripts/sql-query.mjs "SQL"');
  process.exit(2);
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  return (line?.slice("DATABASE_URL=".length) ?? "").trim();
}

const client = new Client({ connectionString: databaseUrl() });
await client.connect();
try {
  const res = await client.query(sql);
  const row = res.rows[0];
  if (!row) {
    process.stdout.write("");
  } else {
    const v = Object.values(row)[0];
    process.stdout.write(v == null ? "" : String(v));
  }
} finally {
  await client.end();
}
