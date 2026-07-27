import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  process.env.DATABASE_URL = loadDatabaseUrl();
  const { checkLedgerInvariant } = await import(
    "../artifacts/api-server/src/lib/ledgerInvariant.ts"
  );
  const { db, pool } = await import("@workspace/db");

  const result = await checkLedgerInvariant(db);
  await pool.end();

  if (!result.ok) {
    for (const line of result.details) {
      console.error(line);
    }
    console.error(
      `FAIL: groups=${result.nonZeroGroups} wallet_mismatches=${result.walletMismatches}`,
    );
    process.exit(1);
  }
  console.log("OK ledger invariant");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
