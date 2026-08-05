import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { loanRequestsTable, loansTable } from "../src/schema/loans.ts";

describe("loanRequestsTable", () => {
  it("maps to loan_requests", () => {
    assert.equal(getTableName(loanRequestsTable), "loan_requests");
  });

  it("exposes loan request columns", () => {
    const cols = getTableColumns(loanRequestsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "amountLzt",
      "borrowerId",
      "borrowerType",
      "createdAt",
      "fundedAmountLzt",
      "fundedLoanId",
      "id",
      "rateBps",
      "status",
      "termDays",
      "updatedAt",
    ]);
  });

  it("requires borrower, amount, term and status defaults", () => {
    const cols = getTableColumns(loanRequestsTable);
    assert.equal(cols.borrowerType.notNull, true);
    assert.equal(cols.borrowerId.notNull, true);
    assert.equal(cols.amountLzt.notNull, true);
    assert.equal(cols.termDays.notNull, true);
    assert.equal(cols.rateBps.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.fundedAmountLzt.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
    assert.equal(cols.fundedLoanId.notNull, false);
  });
});

describe("loansTable", () => {
  it("maps to loans", () => {
    assert.equal(getTableName(loansTable), "loans");
  });

  it("exposes loan columns", () => {
    const cols = getTableColumns(loansTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "borrowerId",
      "borrowerType",
      "closedAt",
      "defaultedAt",
      "dueAt",
      "escrowLzt",
      "id",
      "lenderId",
      "lenderPayoutMode",
      "lenderType",
      "loanType",
      "outstandingLzt",
      "platformFeeLzt",
      "principalLzt",
      "rateBps",
      "repaidLzt",
      "requestId",
      "startedAt",
      "status",
    ]);
  });

  it("requires parties, principal, outstanding and payout defaults", () => {
    const cols = getTableColumns(loansTable);
    assert.equal(cols.loanType.notNull, true);
    assert.equal(cols.lenderType.notNull, true);
    assert.equal(cols.lenderId.notNull, true);
    assert.equal(cols.borrowerType.notNull, true);
    assert.equal(cols.borrowerId.notNull, true);
    assert.equal(cols.principalLzt.notNull, true);
    assert.equal(cols.outstandingLzt.notNull, true);
    assert.equal(cols.repaidLzt.notNull, true);
    assert.equal(cols.escrowLzt.notNull, true);
    assert.equal(cols.platformFeeLzt.notNull, true);
    assert.equal(cols.rateBps.notNull, true);
    assert.equal(cols.lenderPayoutMode.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.startedAt.notNull, true);
    assert.equal(cols.requestId.notNull, false);
    assert.equal(cols.dueAt.notNull, false);
    assert.equal(cols.closedAt.notNull, false);
    assert.equal(cols.defaultedAt.notNull, false);
  });
});
