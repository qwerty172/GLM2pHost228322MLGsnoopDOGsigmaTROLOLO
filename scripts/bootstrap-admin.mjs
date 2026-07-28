/**
 * Grant platform admin flag to a host (local dev bootstrap).
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs                    # first host in DB
 *   node scripts/bootstrap-admin.mjs <hostToken>        # by token
 *   node scripts/bootstrap-admin.mjs --email-like name  # ilike display_name
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "lib/db/package.json"));
const pg = require("pg");
const { Client } = pg;

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  return (line?.slice("DATABASE_URL=".length) ?? "").trim();
}

const arg = process.argv[2];

const client = new Client({ connectionString: databaseUrl() });
await client.connect();

try {
  let row;
  if (!arg) {
    const res = await client.query(
      `SELECT id, host_token, display_name, is_admin FROM hosts ORDER BY created_at ASC LIMIT 1`,
    );
    row = res.rows[0];
  } else if (arg === "--help" || arg === "-h") {
    console.log("Usage: node scripts/bootstrap-admin.mjs [hostToken | --email-like pattern]");
    process.exit(0);
  } else if (arg.startsWith("--email-like")) {
    const pattern = process.argv[3] ?? "%";
    const res = await client.query(
      `SELECT id, host_token, display_name, is_admin FROM hosts WHERE display_name ILIKE $1 LIMIT 1`,
      [pattern],
    );
    row = res.rows[0];
  } else {
    const res = await client.query(
      `SELECT id, host_token, display_name, is_admin FROM hosts WHERE host_token = $1 LIMIT 1`,
      [arg],
    );
    row = res.rows[0];
  }

  if (!row) {
    console.error("Хост не найден. Сначала зарегистрируй хост через Web UI.");
    process.exit(1);
  }

  await client.query(`UPDATE hosts SET is_admin = 1 WHERE id = $1`, [row.id]);

  console.log("OK — is_admin=1");
  console.log(`  id: ${row.id}`);
  console.log(`  display_name: ${row.display_name}`);
  console.log(`  host_token: ${row.host_token?.slice(0, 8)}…`);
  console.log("");
  console.log("Открой http://localhost:5000/admin");
  console.log("Введи ADMIN_SECRET из .env и войди как этот хост.");
} finally {
  await client.end();
}
