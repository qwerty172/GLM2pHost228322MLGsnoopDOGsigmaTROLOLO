/**
 * Integration: block session reclaim must not double-debit or duplicate ledger rows.
 * Requires DATABASE_URL_TEST (CI provides Postgres service).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, and } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL_TEST;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("block reclaim idempotency", { skip: !dbUrl }, () => {
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

  it("two consecutive reclaims debit block reserve only once", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [game] = await db
      .insert(gamesTable)
      .values({
        slug: `block-reclaim-${suffix}`,
        title: "Block Reclaim Test",
      })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "Block Reclaim Host",
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
        displayName: "Block Player",
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
      })
      .returning();

    const balanceBefore = player.withdrawableBalanceLzt;
    const blockMinutes = 10;
    const ratePerMinuteLzt = 8; // 0.04 USD × 200
    const blockReservedLzt = blockMinutes * ratePerMinuteLzt;

    const claimBody = {
      playerWalletToken,
      paymentSource: "green",
      blockMinutes,
    };

    const first = await api(
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(playerToken)}/claim`,
      claimBody,
    );
    assert.equal(first.status, 200, `first claim failed: ${JSON.stringify(first.data)}`);

    const second = await api(
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(playerToken)}/claim`,
      claimBody,
    );
    assert.equal(second.status, 200, `reclaim failed: ${JSON.stringify(second.data)}`);

    const ledgerRows = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_reserve"),
          eq(ledgerTable.refType, "session"),
          eq(ledgerTable.refId, session.id),
        ),
      );
    assert.equal(
      ledgerRows.length,
      1,
      `expected exactly one block_reserve ledger row, got ${ledgerRows.length}`,
    );

    const [playerAfter] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));
    assert.equal(
      playerAfter.green,
      balanceBefore - blockReservedLzt,
      "player balance should be debited exactly once for the block reserve",
    );
  });
});
