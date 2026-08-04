import { describe, expect, it } from "vitest";
import { splitPayoutLzt, SYSTEM_INTEREST_RESERVE, SYSTEM_PLATFORM_FEES } from "./economy";

describe("economy splitPayoutLzt", () => {
  it("splits 50/50 without debt", () => {
    expect(splitPayoutLzt(10, 0)).toEqual({ cash: 5, balance: 5, debt: 0 });
    expect(splitPayoutLzt(1, 0)).toEqual({ cash: 1, balance: 0, debt: 0 });
  });

  it("applies 40/40/20 with debt", () => {
    const r = splitPayoutLzt(100, 50);
    expect(r.debt).toBe(40);
    expect(r.cash + r.balance + r.debt).toBe(100);
  });

  it("exports system account ids", () => {
    expect(SYSTEM_INTEREST_RESERVE).toBe("interest_reserve");
    expect(SYSTEM_PLATFORM_FEES).toBe("platform_fees");
  });
});
