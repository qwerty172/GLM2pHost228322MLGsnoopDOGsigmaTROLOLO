/**
 * Economy E2E: deposit → per-minute play → block tariff → P2P loan → repay → withdraw.
 * Requires DATABASE_URL_TEST (CI Postgres service).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  setupIntegrationHarness,
  teardownIntegrationHarness,
  api,
  uniqueSuffix,
  type IntegrationCtx,
} from "./helpers/integrationHarness";
import {
  applyDepositCents,
  creditPayoutToUser,
  recordWithdrawalDebit,
  writeLedger,
  type DbTx,
} from "../lib/economy";
import { checkLedgerInvariant } from "../lib/ledgerInvariant";

const dbUrl = process.env.DATABASE_URL_TEST;
const RATE_PER_MINUTE_LZT = 8; // 0.04 USD × 200

async function billPlayerMinute(
  tx: DbTx,
  args: {
    sessionId: string;
    hostId: string;
    playerId: string;
    costLzt: number;
  },
): Promise<void> {
  const { billingEventsTable, playersTable } = await import("@workspace/db");

  const debited = await tx
    .update(playersTable)
    .set({
      withdrawableBalanceLzt: sql`${playersTable.withdrawableBalanceLzt} - ${args.costLzt}`,
    })
    .where(
      and(
        eq(playersTable.id, args.playerId),
        sql`${playersTable.withdrawableBalanceLzt} >= ${args.costLzt}`,
      ),
    )
    .returning({ id: playersTable.id });
  assert.ok(debited.length > 0, "player short for minute billing");

  const payoutSplit = await creditPayoutToUser(tx, {
    ownerType: "host",
    ownerId: args.hostId,
    amountLzt: args.costLzt,
    kind: "session_tick",
    refType: "session",
    refId: args.sessionId,
  });

  await tx.insert(billingEventsTable).values([
    {
      sessionId: args.sessionId,
      hostId: args.hostId,
      playerId: args.playerId,
      minutes: 1,
      bucket: "green",
      playerDebitLzt: args.costLzt,
      hostCreditLzt: payoutSplit.cash,
      kind: "session_tick",
    },
    {
      sessionId: args.sessionId,
      hostId: args.hostId,
      playerId: args.playerId,
      minutes: 1,
      bucket: "blue",
      playerDebitLzt: 0,
      hostCreditLzt: payoutSplit.balance,
      kind: "session_tick",
    },
  ]);

  await writeLedger(tx, [
    {
      groupId: randomUUID(),
      kind: "session_tick",
      ownerType: "player",
      ownerId: args.playerId,
      bucket: "cash",
      deltaLzt: -args.costLzt,
      refType: "session",
      refId: args.sessionId,
    },
  ]);
}

describe("economy E2E", { skip: !dbUrl }, () => {
  let ctx: IntegrationCtx;

  before(async () => {
    ctx = await setupIntegrationHarness(dbUrl!);
  });

  after(async () => {
    await teardownIntegrationHarness(ctx);
  });

  it("deposit → play → block tariff → loan → repay → withdraw keeps wallets consistent", async () => {
    const suffix = uniqueSuffix();
    const {
      db,
      baseUrl,
      tables: {
        gamesTable,
        hostsTable,
        playersTable,
        sessionsTable,
        billingEventsTable,
        loansTable,
        ledgerTable,
      },
    } = ctx;

    const [game] = await db
      .insert(gamesTable)
      .values({ slug: `e2e-${suffix}`, title: "Economy E2E Game" })
      .returning();

    const hostToken = `host-${suffix}`;
    const [host] = await db
      .insert(hostsTable)
      .values({
        hostToken,
        displayName: "E2E Host",
        gameId: game.id,
        minutePriceUsd: "0.04",
        launchPriceUsd: "0",
      })
      .returning();

    const borrowerToken = `borrower-${suffix}`;
    const lenderToken = `lender-${suffix}`;
    const [borrower] = await db
      .insert(playersTable)
      .values({
        playerToken: borrowerToken,
        displayName: "Borrower",
        withdrawableBalanceLzt: 0,
        internalBalanceLzt: 0,
      })
      .returning();
    const [lender] = await db
      .insert(playersTable)
      .values({
        playerToken: lenderToken,
        displayName: "Lender",
        withdrawableBalanceLzt: 0,
        internalBalanceLzt: 0,
      })
      .returning();

    const depositCents = 5_000; // $50
    await db.transaction(async (tx) => {
      await applyDepositCents(tx, {
        ownerType: "player",
        ownerId: borrower.id,
        grossUsdtCents: depositCents,
        refType: "test",
        refId: `borrower-${suffix}`,
      });
      await applyDepositCents(tx, {
        ownerType: "player",
        ownerId: lender.id,
        grossUsdtCents: depositCents,
        refType: "test",
        refId: `lender-${suffix}`,
      });
    });

    let invariant = await checkLedgerInvariant(db);
    assert.equal(invariant.ok, true, `after deposits: ${JSON.stringify(invariant)}`);

    const [borrowerAfterDeposit] = await db
      .select({
        green: playersTable.withdrawableBalanceLzt,
        blue: playersTable.internalBalanceLzt,
      })
      .from(playersTable)
      .where(eq(playersTable.id, borrower.id));
    assert.ok(
      borrowerAfterDeposit.green + borrowerAfterDeposit.blue > 0,
      "borrower should have LZT after deposit",
    );

    const minuteSessionToken = `minute-${suffix}`;
    const [minuteSession] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: minuteSessionToken,
        appName: "Minute Play",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
      })
      .returning();

    const minuteClaim = await api(
      baseUrl,
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(minuteSessionToken)}/claim`,
      { playerWalletToken: borrowerToken, paymentSource: "green" },
    );
    assert.equal(minuteClaim.status, 200, JSON.stringify(minuteClaim.data));

    await db.transaction(async (tx) => {
      await billPlayerMinute(tx, {
        sessionId: minuteSession.id,
        hostId: host.id,
        playerId: borrower.id,
        costLzt: RATE_PER_MINUTE_LZT,
      });
      await billPlayerMinute(tx, {
        sessionId: minuteSession.id,
        hostId: host.id,
        playerId: borrower.id,
        costLzt: RATE_PER_MINUTE_LZT,
      });
    });

    const minuteTicks = await db
      .select({ id: billingEventsTable.id })
      .from(billingEventsTable)
      .where(
        and(
          eq(billingEventsTable.sessionId, minuteSession.id),
          eq(billingEventsTable.kind, "session_tick"),
          eq(billingEventsTable.bucket, "green"),
        ),
      );
    assert.equal(minuteTicks.length, 2, "two per-minute ticks recorded");

    const blockSessionToken = `block-${suffix}`;
    const blockMinutes = 5;
    const blockReservedLzt = blockMinutes * RATE_PER_MINUTE_LZT;
    const [blockSession] = await db
      .insert(sessionsTable)
      .values({
        hostId: host.id,
        gameId: game.id,
        playerToken: blockSessionToken,
        appName: "Block Play",
        status: "active",
        ratePerMinute: "0.04",
        paymentSource: "green",
      })
      .returning();

    const [borrowerBeforeBlock] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, borrower.id));

    const blockClaim = await api(
      baseUrl,
      "POST",
      `/sessions/by-player-token/${encodeURIComponent(blockSessionToken)}/claim`,
      {
        playerWalletToken: borrowerToken,
        paymentSource: "green",
        blockMinutes,
      },
    );
    assert.equal(blockClaim.status, 200, JSON.stringify(blockClaim.data));

    const blockReserves = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_reserve"),
          eq(ledgerTable.refId, blockSession.id),
        ),
      );
    assert.equal(blockReserves.length, 1, "block reserve debited once");

    const [borrowerAfterBlockClaim] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, borrower.id));
    assert.equal(
      borrowerAfterBlockClaim.green,
      borrowerBeforeBlock.green - blockReservedLzt,
      "block reserve deducted from green bucket",
    );

    const blockEnd = await api(baseUrl, "PATCH", `/sessions/${blockSession.id}/end`, {
      hostToken,
    });
    assert.equal(blockEnd.status, 200, JSON.stringify(blockEnd.data));

    const blockRefunds = await db
      .select({ delta: ledgerTable.deltaLzt })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "block_refund"),
          eq(ledgerTable.refId, blockSession.id),
        ),
      );
    assert.equal(blockRefunds.length, 1);
    assert.equal(blockRefunds[0].delta, blockReservedLzt, "full block refunded on immediate end");

    const loanAmountLzt = 400;
    const loanReq = await api(baseUrl, "POST", "/loans/requests", {
      userToken: borrowerToken,
      amountLzt: loanAmountLzt,
      termDays: 60,
      rateBps: 0,
    });
    assert.equal(loanReq.status, 201, JSON.stringify(loanReq.data));
    const requestId = String(loanReq.data.id);

    const fund = await api(baseUrl, "POST", `/loans/requests/${requestId}/fund`, {
      userToken: lenderToken,
      source: "cash",
      payoutMode: "cash_on_close",
    });
    assert.equal(fund.status, 201, JSON.stringify(fund.data));
    const loan = fund.data.loan as { id: string };
    const loanId = loan.id;

    const [loanRow] = await db
      .select({ outstanding: loansTable.outstandingLzt, status: loansTable.status })
      .from(loansTable)
      .where(eq(loansTable.id, loanId));
    assert.equal(loanRow.status, "active");
    assert.equal(loanRow.outstanding, loanAmountLzt);

    invariant = await checkLedgerInvariant(db);
    assert.equal(invariant.ok, true, `after loan fund: ${JSON.stringify(invariant)}`);

    const repay = await api(baseUrl, "POST", `/loans/${loanId}/repay`, {
      userToken: borrowerToken,
      amountLzt: loanAmountLzt,
      source: "cash",
    });
    assert.equal(repay.status, 200, JSON.stringify(repay.data));

    const [loanAfterRepay] = await db
      .select({ outstanding: loansTable.outstandingLzt, status: loansTable.status })
      .from(loansTable)
      .where(eq(loansTable.id, loanId));
    assert.equal(loanAfterRepay.outstanding, 0);
    assert.equal(loanAfterRepay.status, "closed");

    const [borrowerBeforeWithdraw] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, borrower.id));

    const withdrawLzt = 100;
    const withdrawn = await db.transaction(async (tx) =>
      recordWithdrawalDebit(tx, {
        ownerType: "player",
        ownerId: borrower.id,
        amountLzt: withdrawLzt,
        amountUsdtCents: 50,
        refType: "test",
        refId: `withdraw-${suffix}`,
      }),
    );
    assert.equal(withdrawn, true, "withdrawal should debit cash bucket");

    const [borrowerAfterWithdraw] = await db
      .select({ green: playersTable.withdrawableBalanceLzt })
      .from(playersTable)
      .where(eq(playersTable.id, borrower.id));
    assert.equal(
      borrowerAfterWithdraw.green,
      borrowerBeforeWithdraw.green - withdrawLzt,
      "withdrawal debited from green bucket",
    );

    const withdrawals = await db
      .select({ id: ledgerTable.id })
      .from(ledgerTable)
      .where(
        and(
          eq(ledgerTable.kind, "withdrawal"),
          eq(ledgerTable.ownerId, borrower.id),
        ),
      );
    assert.equal(withdrawals.length, 1, "withdrawal ledger row recorded");
  });
});
