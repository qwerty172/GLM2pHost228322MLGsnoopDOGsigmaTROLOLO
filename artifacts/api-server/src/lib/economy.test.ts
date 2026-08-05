import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

vi.mock("@workspace/db", () => {
  const tableStub = {
    id: "id",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    internalBalanceLzt: "internalBalanceLzt",
    creditDebtLzt: "creditDebtLzt",
    creditReceivableLzt: "creditReceivableLzt",
    lifetimeDepositUsdtCents: "lifetimeDepositUsdtCents",
    premiumUntil: "premiumUntil",
    maxDepositUsdtCents: "maxDepositUsdtCents",
    maxWithdrawalUsdtCents: "maxWithdrawalUsdtCents",
    key: "key",
    balanceLzt: "balanceLzt",
    updatedAt: "updatedAt",
    kind: "kind",
    refType: "refType",
    refId: "refId",
    borrowerType: "borrowerType",
    borrowerId: "borrowerId",
    status: "status",
    startedAt: "startedAt",
    outstandingLzt: "outstandingLzt",
    repaidLzt: "repaidLzt",
    lenderPayoutMode: "lenderPayoutMode",
    lenderType: "lenderType",
    lenderId: "lenderId",
    escrowLzt: "escrowLzt",
  };
  return {
    hostsTable: tableStub,
    playersTable: tableStub,
    devKeysTable: tableStub,
    ledgerTable: tableStub,
    loansTable: tableStub,
    systemAccountsTable: tableStub,
    outboxTable: tableStub,
  };
});

const queryQueue: unknown[][] = [];

function queueResults(...batches: unknown[][]) {
  queryQueue.push(...batches);
}

function nextResult(): unknown[] {
  return queryQueue.shift() ?? [];
}

function makeQueryable() {
  const result = {
    orderBy: vi.fn(function orderBy(this: typeof result) {
      return this;
    }),
    limit: vi.fn(function limit(this: typeof result) {
      return this;
    }),
    returning: vi.fn(function returning(this: typeof result) {
      return this;
    }),
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(nextResult()).then(onFulfilled);
    },
  };
  return result;
}

function mockTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => makeQueryable()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => makeQueryable()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve().then(onFulfilled);
        },
      })),
    })),
  };
}

const {
  SYSTEM_INTEREST_RESERVE,
  SYSTEM_PLATFORM_FEES,
  splitPayoutLzt,
  pledgerLimitLzt,
  creditPayoutToUser,
  payInternal,
  repayBorrowerDebt,
  applyDepositCents,
  creditDevKeyDeposit,
  recordWithdrawalDebit,
  systemAccountBalance,
  drawFromSystemAccount,
  hasBlockReserveLedger,
  debitBlockReserve,
} = await import("./economy");

describe("economy pure helpers", () => {
  it("splits payout without debt 50/50", () => {
    expect(splitPayoutLzt(100, 0)).toEqual({ cash: 50, balance: 50, debt: 0 });
    expect(splitPayoutLzt(1, 0)).toEqual({ cash: 1, balance: 0, debt: 0 });
  });

  it("splits payout with debt 40/40/20", () => {
    const split = splitPayoutLzt(100, 200);
    expect(split.debt).toBe(40);
    expect(split.cash + split.balance + split.debt).toBe(100);
  });

  it("computes pledger limit from deposit/withdrawal history", () => {
    expect(
      pledgerLimitLzt({ maxDepositUsdtCents: 500, maxWithdrawalUsdtCents: 1000 }),
    ).toBe(2000);
    expect(SYSTEM_PLATFORM_FEES).toBe("platform_fees");
    expect(SYSTEM_INTEREST_RESERVE).toBe("interest_reserve");
  });
});

describe("systemAccountBalance", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns stored balance for a system account key", async () => {
    queueResults([{ b: 1200 }]);
    const tx = mockTx();
    await expect(systemAccountBalance(tx as never, SYSTEM_INTEREST_RESERVE)).resolves.toBe(
      1200,
    );
  });

  it("returns 0 when the system account row is missing", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(systemAccountBalance(tx as never, SYSTEM_INTEREST_RESERVE)).resolves.toBe(0);
  });
});

describe("drawFromSystemAccount", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("no-ops non-positive amounts", async () => {
    const tx = mockTx();
    await expect(drawFromSystemAccount(tx as never, SYSTEM_INTEREST_RESERVE, 0)).resolves.toBe(
      true,
    );
  });

  it("returns false when the reserve is short", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(drawFromSystemAccount(tx as never, SYSTEM_INTEREST_RESERVE, 50)).resolves.toBe(
      false,
    );
  });

  it("returns true when the debit succeeds", async () => {
    queueResults([{ key: SYSTEM_INTEREST_RESERVE }]);
    const tx = mockTx();
    await expect(drawFromSystemAccount(tx as never, SYSTEM_INTEREST_RESERVE, 50)).resolves.toBe(
      true,
    );
  });
});

describe("creditPayoutToUser", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns zeros for non-positive amounts", async () => {
    const tx = mockTx();
    await expect(
      creditPayoutToUser(tx as never, {
        ownerType: "player",
        ownerId: "p1",
        amountLzt: 0,
        kind: "test",
      }),
    ).resolves.toEqual({ cash: 0, balance: 0, debt: 0 });
  });

  it("credits a 50/50 split when the recipient has no debt", async () => {
    queueResults([{ cash: 0, balance: 0, debt: 0 }]);
    const tx = mockTx();
    await expect(
      creditPayoutToUser(tx as never, {
        ownerType: "host",
        ownerId: "h1",
        amountLzt: 100,
        kind: "minute_earn",
      }),
    ).resolves.toEqual({ cash: 50, balance: 50, debt: 0 });
    expect(tx.insert).toHaveBeenCalled();
  });
});

describe("payInternal", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("rejects non-positive amounts", async () => {
    const tx = mockTx();
    await expect(
      payInternal(tx as never, {
        fromType: "player",
        fromId: "p1",
        toType: "host",
        toId: "h1",
        amountLzt: 0,
        source: "balance",
      }),
    ).resolves.toEqual({ ok: false, reason: "amount must be positive" });
  });

  it("rejects when the payer bucket is short", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(
      payInternal(tx as never, {
        fromType: "player",
        fromId: "p1",
        toType: "host",
        toId: "h1",
        amountLzt: 40,
        source: "cash",
      }),
    ).resolves.toEqual({ ok: false, reason: "insufficient cash balance" });
  });

  it("routes a successful internal payment to the recipient", async () => {
    queueResults(
      [{ id: "p1" }],
      [{ cash: 0, balance: 0, debt: 0 }],
    );
    const tx = mockTx();
    await expect(
      payInternal(tx as never, {
        fromType: "player",
        fromId: "p1",
        toType: "host",
        toId: "h1",
        amountLzt: 40,
        source: "balance",
      }),
    ).resolves.toEqual({ ok: true, split: { cash: 20, balance: 20, debt: 0 } });
  });
});

describe("repayBorrowerDebt", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns 0 for non-positive amounts", async () => {
    const tx = mockTx();
    await expect(
      repayBorrowerDebt(tx as never, {
        borrowerType: "player",
        borrowerId: "p1",
        amountLzt: 0,
      }),
    ).resolves.toBe(0);
  });

  it("returns 0 when the borrower has no open loans", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(
      repayBorrowerDebt(tx as never, {
        borrowerType: "player",
        borrowerId: "p1",
        amountLzt: 100,
      }),
    ).resolves.toBe(0);
  });
});

describe("applyDepositCents", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns zeros for non-positive gross amounts", async () => {
    const tx = mockTx();
    await expect(
      applyDepositCents(tx as never, {
        ownerType: "player",
        ownerId: "p1",
        grossUsdtCents: 0,
      }),
    ).resolves.toEqual({
      feeLzt: 0,
      cashLzt: 0,
      balanceLzt: 0,
      newLifetimeCents: 0,
      grantedFreePremium: false,
    });
  });
});

describe("creditDevKeyDeposit", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns zeros for non-positive gross amounts", async () => {
    const tx = mockTx();
    await expect(
      creditDevKeyDeposit(tx as never, {
        devKeyId: "dk1",
        grossUsdtCents: 0,
      }),
    ).resolves.toEqual({ cashLzt: 0, balanceLzt: 0, newLifetimeCents: 0 });
  });
});

describe("recordWithdrawalDebit", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns false when cash is insufficient", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(
      recordWithdrawalDebit(tx as never, {
        ownerType: "player",
        ownerId: "p1",
        amountLzt: 100,
        amountUsdtCents: 50,
      }),
    ).resolves.toBe(false);
  });

  it("records a successful withdrawal debit", async () => {
    queueResults([{ id: "p1" }]);
    const tx = mockTx();
    await expect(
      recordWithdrawalDebit(tx as never, {
        ownerType: "host",
        ownerId: "h1",
        amountLzt: 200,
        amountUsdtCents: 100,
        refId: "wd-1",
      }),
    ).resolves.toBe(true);
    expect(tx.insert).toHaveBeenCalled();
  });
});

describe("hasBlockReserveLedger", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("returns true when block_reserve ledger row exists", async () => {
    queueResults([{ id: "ledger-1" }]);
    const tx = mockTx();
    await expect(hasBlockReserveLedger(tx as never, "session-1")).resolves.toBe(true);
  });

  it("returns false when no ledger row", async () => {
    queueResults([]);
    const tx = mockTx();
    await expect(hasBlockReserveLedger(tx as never, "session-1")).resolves.toBe(false);
  });
});

describe("debitBlockReserve", () => {
  beforeEach(() => {
    queryQueue.length = 0;
  });

  it("skips debit when ledger already has block_reserve", async () => {
    queueResults([{ id: "ledger-1" }]);
    const tx = mockTx();
    await expect(
      debitBlockReserve(tx as never, {
        playerId: "player-1",
        sessionId: "session-1",
        amountLzt: 400,
        bucket: "cash",
      }),
    ).resolves.toEqual({ ok: true });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("returns insufficient balance when debit fails", async () => {
    queueResults([], []);
    const tx = mockTx();
    await expect(
      debitBlockReserve(tx as never, {
        playerId: "player-1",
        sessionId: "session-2",
        amountLzt: 400,
        bucket: "cash",
      }),
    ).resolves.toEqual({ ok: false, reason: "insufficient balance for block reserve" });
  });
});
