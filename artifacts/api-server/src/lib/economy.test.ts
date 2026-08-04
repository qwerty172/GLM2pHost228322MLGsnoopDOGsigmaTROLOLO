import { describe, expect, it } from "vitest";
import { splitPayoutLzt, pledgerLimitLzt, SYSTEM_INTEREST_RESERVE, SYSTEM_PLATFORM_FEES } from "./economy";

describe("splitPayoutLzt", () => {
  it("splits 50/50 when recipient has no debt", () => {
    expect(splitPayoutLzt(100, 0)).toEqual({ cash: 50, balance: 50, debt: 0 });
    expect(splitPayoutLzt(1, 0)).toEqual({ cash: 1, balance: 0, debt: 0 });
  });

  it("applies 40/40/20 when recipient owes debt", () => {
    const split = splitPayoutLzt(100, 50);
    expect(split.debt).toBe(40);
    expect(split.cash + split.balance + split.debt).toBe(100);
  });

  it("caps debt repayment at outstanding debt", () => {
    const split = splitPayoutLzt(100, 10);
    expect(split.debt).toBe(10);
    expect(split.cash + split.balance + split.debt).toBe(100);
  });

  it("returns zeros for non-positive amounts", () => {
    expect(splitPayoutLzt(0, 100)).toEqual({ cash: 0, balance: 0, debt: 0 });
  });
});

describe("pledgerLimitLzt", () => {
  it("uses max deposit/withdrawal cents × 2", () => {
    expect(pledgerLimitLzt({ maxDepositUsdtCents: 500, maxWithdrawalUsdtCents: 1000 })).toBe(2000);
  });
});

describe("system account constants", () => {
  it("exports known keys", () => {
    expect(SYSTEM_INTEREST_RESERVE).toBe("interest_reserve");
    expect(SYSTEM_PLATFORM_FEES).toBe("platform_fees");
  });
});
