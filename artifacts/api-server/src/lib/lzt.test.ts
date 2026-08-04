import { describe, expect, it } from "vitest";
import { LZT_PER_USDT, lztToUsdt, pickPlayerBucket, usdtToLzt, usdtToLztRound } from "./lzt";

describe("lzt", () => {
  it("converts USDT ↔ LZT", () => {
    expect(LZT_PER_USDT).toBe(200);
    expect(usdtToLzt(1)).toBe(200);
    expect(lztToUsdt(200)).toBe(1);
    expect(usdtToLztRound(0.0025)).toBe(1);
  });

  it("pickPlayerBucket respects bucket rules", () => {
    expect(pickPlayerBucket("auto", 100, 100, 0)).toBe("green");
    expect(pickPlayerBucket("auto", 100, 50, 100)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 50, 50)).toBeNull();
  });
});
