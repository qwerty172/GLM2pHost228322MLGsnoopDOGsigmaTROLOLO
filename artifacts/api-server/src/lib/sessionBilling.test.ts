import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  billingEventsTable: {},
  ledgerTable: {},
  playersTable: {},
  sessionsTable: {},
}));

import { splitRefundByReserveBuckets } from "./sessionBilling";

describe("splitRefundByReserveBuckets", () => {
  it("returns all cash when reserve was only from green bucket", () => {
    expect(splitRefundByReserveBuckets(500, 1000, 0)).toEqual({
      cash: 500,
      balance: 0,
    });
  });

  it("returns all balance when reserve was only from blue bucket (auto path)", () => {
    expect(splitRefundByReserveBuckets(500, 0, 1000)).toEqual({
      cash: 0,
      balance: 500,
    });
  });

  it("splits proportionally across mixed renew buckets", () => {
    const split = splitRefundByReserveBuckets(600, 1000, 1000);
    expect(split.cash + split.balance).toBe(600);
    expect(split.cash).toBe(300);
    expect(split.balance).toBe(300);
  });

  it("returns zeros for non-positive refund", () => {
    expect(splitRefundByReserveBuckets(0, 100, 100)).toEqual({
      cash: 0,
      balance: 0,
    });
  });
});
