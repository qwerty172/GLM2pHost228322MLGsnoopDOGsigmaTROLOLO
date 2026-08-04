import { describe, expect, it } from "vitest";
import {
  LZT_PER_USDT,
  lztToUsdt,
  pickPlayerBucket,
  usdtToLzt,
  usdtToLztRound,
} from "./lzt";

describe("lzt conversions", () => {
  it("converts USDT ↔ LZT at fixed rate", () => {
    expect(LZT_PER_USDT).toBe(200);
    expect(usdtToLzt(1)).toBe(200);
    expect(usdtToLzt(1.999)).toBe(399);
    expect(usdtToLzt(0)).toBe(0);
    expect(usdtToLzt(-1)).toBe(0);
    expect(lztToUsdt(200)).toBe(1);
    expect(usdtToLztRound(0.0025)).toBe(1);
  });
});

describe("pickPlayerBucket", () => {
  it("never combines green and blue on auto", () => {
    expect(pickPlayerBucket("auto", 100, 100, 0)).toBe("green");
    expect(pickPlayerBucket("auto", 100, 50, 100)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 50, 50)).toBeNull();
    expect(pickPlayerBucket("green", 100, 100, 999)).toBe("green");
    expect(pickPlayerBucket("green", 100, 50, 999)).toBeNull();
    expect(pickPlayerBucket("blue", 100, 999, 100)).toBe("blue");
    expect(pickPlayerBucket("blue", 100, 999, 50)).toBeNull();
  });
});
