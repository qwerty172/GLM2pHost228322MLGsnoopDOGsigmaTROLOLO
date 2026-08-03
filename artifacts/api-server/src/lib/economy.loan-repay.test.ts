import { describe, it, expect, vi } from "vitest";

/**
 * Guards the manual loan-repay concurrency fix: repayBorrowerDebt must use a
 * conditional outstandingLzt check so a lost update cannot double-pay a lender.
 */
vi.mock("@workspace/db", () => ({
  loansTable: {
    id: "id",
    outstandingLzt: "outstandingLzt",
    repaidLzt: "repaidLzt",
    status: "status",
    borrowerType: "borrowerType",
    borrowerId: "borrowerId",
    lenderType: "lenderType",
    lenderId: "lenderId",
    lenderPayoutMode: "lenderPayoutMode",
    startedAt: "startedAt",
  },
  hostsTable: {},
  playersTable: {},
  ledgerTable: {},
}));

import { repayBorrowerDebt } from "./economy";

describe("repayBorrowerDebt concurrency guard", () => {
  it("fails the transaction when outstanding was already reduced", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    const orderBy = vi.fn().mockResolvedValue([
      {
        id: "loan-1",
        outstandingLzt: 100,
        repaidLzt: 0,
        status: "active",
        borrowerType: "player",
        borrowerId: "player-1",
        lenderType: "host",
        lenderId: "host-1",
        lenderPayoutMode: "cash_on_close",
        startedAt: new Date(),
      },
    ]);
    const whereSelect = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from });

    const adjustUserBucket = vi.fn().mockResolvedValue(true);
    const writeLedger = vi.fn().mockResolvedValue(undefined);

    const tx = {
      select,
      update,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    vi.doMock("./economy", async (importOriginal) => {
      const mod = await importOriginal<typeof import("./economy")>();
      return { ...mod, adjustUserBucket, writeLedger };
    });

    await expect(
      repayBorrowerDebt(tx, {
        borrowerType: "player",
        borrowerId: "player-1",
        amountLzt: 100,
        onlyLoanId: "loan-1",
      }),
    ).rejects.toThrow(/concurrently/);

    expect(update).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});
