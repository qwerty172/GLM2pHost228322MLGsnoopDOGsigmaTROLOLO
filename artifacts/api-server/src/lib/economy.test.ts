import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { splitPayoutLzt, pledgerLimitLzt, SYSTEM_PLATFORM_FEES } = await import("./economy");

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
  });
});
