/**
 * Integration: early session end refunds unused block minutes.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and } from "drizzle-orm";
import {
  setupIntegrationHarness,
  teardownIntegrationHarness,
  api,
  uniqueSuffix,
  type IntegrationCtx,
} from "./helpers/integrationHarness";
import { checkLedgerInvariant } from "../lib/ledgerInvariant";

const dbUrl = process.env.DATABASE_URL_TEST;

describe("block end refund", { skip: !dbUrl }, () => {
  let ctx: IntegrationCtx;

  before(async () => {
    ctx = await setupIntegrationHarness(dbUrl!);
  });

  after(async () => {
    await teardownIntegrationHarness(ctx);
  });

  it("refunds unused block minutes on early session end", async () => {
    const suffix = uniqueSuffix();
    const {
      db,
      tables: {
        gamesTable,
        hostsTable,
        playersTable,
        sessionsTable,
        billingEventsTable,
        ledgerTable,
      },
    } = ctx;

    const [game] = await db
      .insert(gamesTable)
      .values({ slug: `refund-${suffix}`, title: "Refund Game" })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "Refund Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
        launchPriceUsd: "0",
      })
      .returning();

    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken: `wallet-${suffix}`,
        displayName: "Refund Player",
        withdrawableBalanceLzt: 10_000,
      })
      .returning();

    const [session] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: `session-${suffix}`,
        appName: "Test",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
        claimedByPlayerId: player.id,
        blockMinutes: 10,
        blockReservedLzt: 80,
      })
      .returning();

    const minutesUsed = 3;
    for (let i = 0; i < minutesUsed; i++) {
      await db.insert(billingEventsTable).values({
        sessionId: session.id,
        hostId: host.id,
        playerId: player.id,
        kind: "session_tick",
        bucket: "green",
        playerDebitLzt: 8,
        hostCreditLzt: 4,
      });
    }

    const balanceBefore = player.withdrawableBalanceLzt;
    const expectedRefund = 80 - minutesUsed * 8;

    const end = await api(
      ctx.baseUrl,
      "PATCH",
      `/sessions/${session.id}/end`,
      { hostToken },
    );
    assert.equal(end.status, 200, JSON.stringify(end.data));

    const refunds = await db
      .select()
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_refund"),
          eq(ledgerTable.refId, session.id),
        ),
      );
    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].deltaLzt, expectedRefund);

    const [playerAfter] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));
    assert.equal(playerAfter.green, balanceBefore + expectedRefund);

    const invariant = await checkLedgerInvariant(db);
    assert.equal(invariant.ok, true, JSON.stringify(invariant));
  });

  it("does not double-refund when end is called on already-ended session", async () => {
    const suffix = uniqueSuffix();
    const {
      db,
      tables: { gamesTable, hostsTable, playersTable, sessionsTable, ledgerTable },
    } = ctx;

    const [game] = await db
      .insert(gamesTable)
      .values({ slug: `refund2-${suffix}`, title: "Refund Game 2" })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
      })
      .returning();

    const [player] = await db
      .insert(playersTable)
      .values({
        playerToken: `wallet-${suffix}`,
        displayName: "Player",
        withdrawableBalanceLzt: 5000,
      })
      .returning();

    const [session] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: `session-${suffix}`,
        appName: "Test",
        status: "active",
        paymentSource: "green",
        claimedByPlayerId: player.id,
        blockMinutes: 10,
        blockReservedLzt: 80,
      })
      .returning();

    const body = { hostToken };
    const first = await api(
      ctx.baseUrl,
      "PATCH",
      `/sessions/${session.id}/end`,
      body,
    );
    assert.equal(first.status, 200);

    const [playerMid] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));

    const second = await api(
      ctx.baseUrl,
      "PATCH",
      `/sessions/${session.id}/end`,
      body,
    );
    assert.equal(second.status, 200);

    const refunds = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_refund"),
          eq(ledgerTable.refId, session.id),
        ),
      );
    assert.equal(refunds.length, 1);

    const [playerAfter] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, player.id));
    assert.equal(playerAfter.green, playerMid.green);
  });
});
