import { describe, expect, it } from "vitest";
import { pledgerLimitLzt, splitPayoutLzt } from "./economy";

describe("economy pure helpers", () => {
  it("splitPayoutLzt 50/50 without debt", () => {
    expect(splitPayoutLzt(10, 0)).toEqual({ cash: 5, balance: 5, debt: 0 });
  });

  it("splitPayoutLzt 40/40/20 with debt", () => {
    const s = splitPayoutLzt(100, 50);
    expect(s.cash + s.balance + s.debt).toBe(100);
    expect(s.debt).toBeGreaterThan(0);
  });

  it("pledgerLimitLzt uses max deposit/withdrawal cents", () => {
    expect(pledgerLimitLzt({ maxDepositUsdtCents: 100, maxWithdrawalUsdtCents: 200 })).toBe(400);
  });
});
