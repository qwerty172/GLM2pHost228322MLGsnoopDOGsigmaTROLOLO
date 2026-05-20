#!/usr/bin/env node
// Idempotent one-shot migration that converts the old single USD `credit_balance`
// columns on `hosts`/`players` into the new dual LZT bucket columns
// (`internal_balance_lzt` + `withdrawable_balance_lzt`), and rebuilds
// `billing_events` to record per-bucket integer-LZT deltas.
//
// Safe to run multiple times. Must run BEFORE `drizzle-kit push` because we
// want push to see the post-migration shape and treat it as a no-op rather
// than try to drop columns containing data.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// `pg` is a transitive dep of @workspace/db — load it from there.
const require = createRequire(path.resolve(here, "..", "lib", "db") + "/");
const pg = require("pg");

const { Client } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set; skipping lzt migration");
  process.exit(0);
}

const LZT_PER_USDT = 200;

const client = new Client({ connectionString: url });
await client.connect();

async function hasColumn(table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return r.rowCount > 0;
}

async function tableExists(table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
    [table],
  );
  return r.rowCount > 0;
}

async function migrateOwner(table) {
  if (!(await tableExists(table))) return;
  await client.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS internal_balance_lzt INTEGER NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS withdrawable_balance_lzt INTEGER NOT NULL DEFAULT 0`,
  );
  if (await hasColumn(table, "credit_balance")) {
    // Existing USD-cent-ish balances become green (withdrawable) LZT.
    await client.query(
      `UPDATE ${table}
          SET withdrawable_balance_lzt = withdrawable_balance_lzt
                                       + FLOOR(COALESCE(credit_balance, 0) * ${LZT_PER_USDT})::int
        WHERE COALESCE(credit_balance, 0) > 0
          AND withdrawable_balance_lzt = 0`,
    );
    await client.query(`ALTER TABLE ${table} DROP COLUMN credit_balance`);
    console.log(`[lzt-migrate] ${table}: migrated credit_balance → LZT buckets`);
  }
}

async function migrateBillingEvents() {
  if (!(await tableExists("billing_events"))) return;
  await client.query(
    `ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'green'`,
  );
  await client.query(
    `ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS player_debit_lzt INTEGER NOT NULL DEFAULT 0`,
  );
  await client.query(
    `ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS host_credit_lzt INTEGER NOT NULL DEFAULT 0`,
  );
  // Backfill from old numeric USD columns if they exist.
  if (await hasColumn("billing_events", "player_debit")) {
    await client.query(
      `UPDATE billing_events
          SET player_debit_lzt = FLOOR(COALESCE(player_debit, 0) * ${LZT_PER_USDT})::int
        WHERE player_debit_lzt = 0 AND COALESCE(player_debit, 0) > 0`,
    );
    await client.query(`ALTER TABLE billing_events DROP COLUMN player_debit`);
  }
  if (await hasColumn("billing_events", "host_credit")) {
    await client.query(
      `UPDATE billing_events
          SET host_credit_lzt = FLOOR(COALESCE(host_credit, 0) * ${LZT_PER_USDT})::int
        WHERE host_credit_lzt = 0 AND COALESCE(host_credit, 0) > 0`,
    );
    await client.query(`ALTER TABLE billing_events DROP COLUMN host_credit`);
  }
  if (await hasColumn("billing_events", "commission_amount")) {
    await client.query(`ALTER TABLE billing_events DROP COLUMN commission_amount`);
  }
}

async function migrateSessions() {
  if (!(await tableExists("sessions"))) return;
  await client.query(
    `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'auto'`,
  );
}

try {
  await migrateOwner("hosts");
  await migrateOwner("players");
  await migrateBillingEvents();
  await migrateSessions();
  console.log("[lzt-migrate] complete");
} catch (err) {
  console.error("[lzt-migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
