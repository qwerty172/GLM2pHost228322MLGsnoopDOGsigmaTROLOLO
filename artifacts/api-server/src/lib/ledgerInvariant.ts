import { sql, eq } from "drizzle-orm";
import { ledgerTable, playersTable } from "@workspace/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@workspace/db/schema";

type DbClient = NodePgDatabase<typeof schema>;

export type LedgerInvariantResult =
  | { ok: true }
  | {
      ok: false;
      nonZeroGroups: number;
      walletMismatches: number;
      details: string[];
    };

/** Verify ledger group sums are zero and player buckets match ledger deltas. */
export async function checkLedgerInvariant(
  client: DbClient,
): Promise<LedgerInvariantResult> {
  const details: string[] = [];

  const groupSums = await client
    .select({
      groupId: ledgerTable.groupId,
      net: sql<number>`SUM(${ledgerTable.deltaLzt})::int`,
    })
    .from(ledgerTable)
    .groupBy(ledgerTable.groupId)
    .having(sql`SUM(${ledgerTable.deltaLzt}) <> 0`);

  const players = await client
    .select({
      id: playersTable.id,
      green: playersTable.withdrawableBalanceLzt,
      blue: playersTable.internalBalanceLzt,
    })
    .from(playersTable);

  const ledgerByPlayer = await client
    .select({
      ownerId: ledgerTable.ownerId,
      cash: sql<number>`SUM(CASE WHEN ${ledgerTable.bucket} = 'cash' THEN ${ledgerTable.deltaLzt} ELSE 0 END)::int`,
      balance: sql<number>`SUM(CASE WHEN ${ledgerTable.bucket} = 'balance' THEN ${ledgerTable.deltaLzt} ELSE 0 END)::int`,
    })
    .from(ledgerTable)
    .where(eq(ledgerTable.ownerType, "player"))
    .groupBy(ledgerTable.ownerId);

  const ledgerMap = new Map(
    ledgerByPlayer.map((r) => [
      r.ownerId!,
      { cash: Number(r.cash ?? 0), balance: Number(r.balance ?? 0) },
    ]),
  );

  let walletMismatches = 0;
  for (const p of players) {
    const led = ledgerMap.get(p.id) ?? { cash: 0, balance: 0 };
    if (Math.abs(p.green - led.cash) > 1 || Math.abs(p.blue - led.balance) > 1) {
      walletMismatches++;
      details.push(
        `player ${p.id}: wallet green=${p.green} blue=${p.blue}, ledger cash=${led.cash} balance=${led.balance}`,
      );
    }
  }

  if (groupSums.length > 0) {
    details.unshift(`${groupSums.length} ledger groups with non-zero net`);
  }

  if (groupSums.length > 0 || walletMismatches > 0) {
    return {
      ok: false,
      nonZeroGroups: groupSums.length,
      walletMismatches,
      details,
    };
  }
  return { ok: true };
}
