import { describe, expect, it } from "vitest";
import { splitPayoutLzt } from "./economy";

describe("economy splitPayoutLzt", () => {
  it("splits 50/50 when no debt", () => {
    expect(splitPayoutLzt(10, 0)).toEqual({ cash: 5, balance: 5, debt: 0 });
    expect(splitPayoutLzt(1, 0)).toEqual({ cash: 1, balance: 0, debt: 0 });
  });

  it("splits 40/40/20 when recipient has debt", () => {
    const r = splitPayoutLzt(100, 50);
    expect(r.debt).toBe(40);
    expect(r.cash + r.balance + r.debt).toBe(100);
  });
});
