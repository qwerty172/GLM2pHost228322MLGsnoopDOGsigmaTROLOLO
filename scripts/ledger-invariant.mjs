import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "lib/db/package.json"));
const pg = require("pg");
const { Client } = pg;

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/\r/g, "");
  }
  const env = readFileSync(join(ROOT, ".env"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found");
  return line.slice("DATABASE_URL=".length).trim().replace(/\r/g, "");
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: loadDatabaseUrl() });
  await client.connect();

  const players = await client.query(`
    SELECT id,
           withdrawable_balance_lzt + internal_balance_lzt AS total_lzt
    FROM players
  `);

  const ledger = await client.query(`
    SELECT owner_id,
           owner_type,
           SUM(CASE WHEN bucket = 'cash' THEN delta_lzt ELSE 0 END) AS cash_delta,
           SUM(CASE WHEN bucket = 'balance' THEN delta_lzt ELSE 0 END) AS balance_delta
    FROM ledger
    WHERE owner_type = 'player'
    GROUP BY owner_id, owner_type
  `);

  const ledgerByPlayer = new Map<string, { cash: number; balance: number }>();
  for (const row of ledger.rows) {
    ledgerByPlayer.set(row.owner_id, {
      cash: Number(row.cash_delta ?? 0),
      balance: Number(row.balance_delta ?? 0),
    });
  }

  let mismatches = 0;
  for (const p of players.rows) {
    const led = ledgerByPlayer.get(p.id) ?? { cash: 0, balance: 0 };
    const playerRow = await client.query(
      `SELECT withdrawable_balance_lzt, internal_balance_lzt FROM players WHERE id = $1`,
      [p.id],
    );
    const w = Number(playerRow.rows[0]?.withdrawable_balance_lzt ?? 0);
    const i = Number(playerRow.rows[0]?.internal_balance_lzt ?? 0);
    // Ledger cash/balance buckets should mirror player green/blue totals when
    // all movements go through writeLedger (approximate check).
    if (Math.abs(w - led.cash) > 1 || Math.abs(i - led.balance) > 1) {
      mismatches++;
      console.error(
        `MISMATCH player ${p.id}: wallet green=${w} blue=${i}, ledger cash=${led.cash} balance=${led.balance}`,
      );
    }
  }

  const groupSums = await client.query(`
    SELECT group_id, SUM(delta_lzt)::bigint AS net
    FROM ledger
    GROUP BY group_id
    HAVING SUM(delta_lzt) <> 0
  `);

  await client.end();

  if (groupSums.rows.length > 0) {
    console.error(`FAIL: ${groupSums.rows.length} ledger groups with non-zero net`);
    process.exit(1);
  }
  if (mismatches > 0) {
    console.error(`FAIL: ${mismatches} player wallet/ledger mismatches`);
    process.exit(1);
  }
  console.log("OK ledger invariant");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
