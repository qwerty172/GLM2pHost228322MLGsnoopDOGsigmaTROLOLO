/**
 * Ghost-billing: ended sessions must not receive further billing ticks.
 * Requires DATABASE_URL_TEST (CI Postgres service).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, sql } from "drizzle-orm";
import {
  setupIntegrationHarness,
  teardownIntegrationHarness,
  api,
  uniqueSuffix,
  type IntegrationCtx,
} from "./helpers/integrationHarness";
import { checkLedgerInvariant } from "../lib/ledgerInvariant";

const dbUrl = process.env.DATABASE_URL_TEST;

async function countBillingEvents(
  db: IntegrationCtx["db"],
  sessionId: string,
): Promise<number> {
  const { billingEventsTable } = await import("@workspace/db");
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(billingEventsTable)
    .where(eq(billingEventsTable.sessionId, sessionId));
  return Number(rows[0]?.n ?? 0);
}

describe("ghost-billing", { skip: !dbUrl }, () => {
  let ctx: IntegrationCtx;
  let runBillingTickOnce: () => Promise<void>;

  before(async () => {
    ctx = await setupIntegrationHarness(dbUrl!);
    ({ runBillingTickOnce } = await import("../lib/billingWorker"));
  });

  after(async () => {
    await teardownIntegrationHarness(ctx);
  });

  it("billing worker does not tick after per-minute session end", async () => {
    const suffix = uniqueSuffix();
    const {
      db,
      baseUrl,
      tables: { gamesTable, hostsTable, playersTable, sessionsTable },
    } = ctx;

    const [game] = await db
      .insert(gamesTable)
      .values({ slug: `ghost-${suffix}`, title: "Ghost Billing Game" })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "Ghost Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
        launchPriceUsd: "0",
      })
      .returning();

    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken: `wallet-${suffix}`,
        displayName: "Ghost Player",
        withdrawableBalanceLzt: 10_000,
        internalBalanceLzt: 0,
      })
      .returning();

    const [session] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: `session-${suffix}`,
        appName: "Ghost Test",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
        claimedByPlayerId: player.id,
        isTest: false,
        lastBilledAt: null,
      })
      .returning();

    await runBillingTickOnce();
    const eventsAfterTick = await countBillingEvents(db, session.id);
    assert.ok(eventsAfterTick >= 1, "expected at least one billing event before end");

    const [playerAfterTick] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));

    const end = await api(baseUrl, "PATCH", `/sessions/${session.id}/end`, {
      hostToken,
      reason: "ghost_billing_test",
    });
    assert.equal(end.status, 200, JSON.stringify(end.data));

    const [ended] = await db
      .select({ status: sessionsTable.status })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, session.id));
    assert.equal(ended?.status, "ended");

    await runBillingTickOnce();
    const eventsAfterEnd = await countBillingEvents(db, session.id);
    assert.equal(
      eventsAfterEnd,
      eventsAfterTick,
      "billing worker must not add events after session end",
    );

    const [playerAfterEnd] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));
    assert.equal(
      playerAfterEnd.green,
      playerAfterTick.green,
      "player balance must not change after ended session tick",
    );

    const invariant = await checkLedgerInvariant(db);
    assert.equal(invariant.ok, true, JSON.stringify(invariant));
  });

  it("billing worker does not tick after block session end", async () => {
    const suffix = uniqueSuffix();
    const {
      db,
      baseUrl,
      tables: { gamesTable, hostsTable, playersTable, sessionsTable, ledgerTable },
    } = ctx;

    const [game] = await db
      .insert(gamesTable)
      .values({ slug: `ghost-block-${suffix}`, title: "Ghost Block Game" })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "Ghost Block Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
        launchPriceUsd: "0",
      })
      .returning();

    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken: `wallet-block-${suffix}`,
        displayName: "Ghost Block Player",
        withdrawableBalanceLzt: 10_000,
      })
      .returning();

    const blockMinutes = 10;
    const blockReservedLzt = blockMinutes * 8;

    const [session] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: `session-block-${suffix}`,
        appName: "Ghost Block Test",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
        claimedByPlayerId: player.id,
        isTest: false,
        blockMinutes,
        blockReservedLzt,
        lastBilledAt: null,
      })
      .returning();

    await runBillingTickOnce();
    const eventsAfterTick = await countBillingEvents(db, session.id);
    assert.ok(eventsAfterTick >= 1, "expected block session tick before end");

    const end = await api(baseUrl, "PATCH", `/sessions/${session.id}/end`, {
      hostToken,
    });
    assert.equal(end.status, 200, JSON.stringify(end.data));

    const refunds = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_refund"),
          eq(ledgerTable.refId, session.id),
        ),
      );
    assert.equal(refunds.length, 1, "block end should refund unused minutes once");

    await runBillingTickOnce();
    const eventsAfterEnd = await countBillingEvents(db, session.id);
    assert.equal(
      eventsAfterEnd,
      eventsAfterTick,
      "no ghost ticks on ended block session",
    );
  });
});
