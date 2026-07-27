/**
 * Integration: renew-block must be idempotent per idempotencyKey.
 * Requires DATABASE_URL_TEST (CI provides Postgres service).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, and, like } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL_TEST;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("block renew idempotency", { skip: !dbUrl }, () => {
  let server: Server;
  let baseUrl: string;
  let pool: import("pg").Pool;
  let db: typeof import("@workspace/db").db;
  let ledgerTable: typeof import("@workspace/db").ledgerTable;
  let playersTable: typeof import("@workspace/db").playersTable;
  let hostsTable: typeof import("@workspace/db").hostsTable;
  let gamesTable: typeof import("@workspace/db").gamesTable;
  let sessionsTable: typeof import("@workspace/db").sessionsTable;

  before(async () => {
    process.env.DATABASE_URL = dbUrl!;
    process.env.RATE_LIMIT_STORAGE = "memory";

    execSync("pnpm exec drizzle-kit push --force --config ./drizzle.config.ts", {
      cwd: join(ROOT, "lib/db"),
      env: { ...process.env, DATABASE_URL: dbUrl! },
      stdio: "pipe",
    });

    const dbMod = await import("@workspace/db");
    pool = dbMod.pool;
    db = dbMod.db;
    ledgerTable = dbMod.ledgerTable;
    playersTable = dbMod.playersTable;
    hostsTable = dbMod.hostsTable;
    gamesTable = dbMod.gamesTable;
    sessionsTable = dbMod.sessionsTable;

    const { default: app } = await import("../app");
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  });

  async function api(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data };
  }

  it("duplicate renew idempotencyKey debits only once", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = `renew-${suffix}`;

    const [game] = await db
      .insert(gamesTable)
      .values({
        slug: `block-renew-${suffix}`,
        title: "Block Renew Test",
      })
      .returning();

    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken: `host-${suffix}`,
        displayName: "Renew Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
        launchPriceUsd: "0",
      })
      .returning();

    const playerWalletToken = `wallet-${suffix}`;
    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken: playerWalletToken,
        displayName: "Renew Player",
        withdrawableBalanceLzt: 10_000,
        internalBalanceLzt: 0,
      })
      .returning();

    const playerToken = `session-${suffix}`;
    const [session] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken,
        appName: "Test Game",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
        claimedByPlayerId: player.id,
        blockMinutes: 10,
        blockReservedLzt: 80,
      })
      .returning();

    const balanceBefore = player.withdrawableBalanceLzt;
    const renewMinutes = 15;
    const addReserve = renewMinutes * 8;
    const renewBody = {
      playerWalletToken,
      blockMinutes: renewMinutes,
      idempotencyKey,
    };

    const first = await api(
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(playerToken)}/renew-block`,
      renewBody,
    );
    assert.equal(first.status, 200, `first renew failed: ${JSON.stringify(first.data)}`);
    assert.equal(first.data.blockMinutes, 25);

    const second = await api(
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(playerToken)}/renew-block`,
      renewBody,
    );
    assert.equal(second.status, 200, `retry renew failed: ${JSON.stringify(second.data)}`);
    assert.equal(second.data.blockMinutes, 25, "retry must not add minutes again");

    const renewLedgerRows = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_reserve"),
          eq(ledgerTable.refType, "session"),
          like(ledgerTable.refId, `${session.id}:renew:%`),
        ),
      );
    assert.equal(
      renewLedgerRows.length,
      1,
      `expected one renew ledger row, got ${renewLedgerRows.length}`,
    );

    const [playerAfter] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));
    assert.equal(
      playerAfter.green,
      balanceBefore - addReserve,
      "player balance should be debited exactly once for the renew",
    );
  });
});
