import { describe, expect, it } from "vitest";
import {
  LZT_PER_USDT,
  lztToUsdt,
  pickPlayerBucket,
  pickPlayerFunding,
  playerCreditAvailableLzt,
  usdtToLzt,
  usdtToLztRound,
} from "./lzt";

describe("lzt", () => {
  it("converts USDT to LZT", () => {
    expect(LZT_PER_USDT).toBe(200);
    expect(usdtToLzt(1.5)).toBe(300);
    expect(usdtToLztRound(1.005)).toBe(201);
    expect(lztToUsdt(200)).toBe(1);
    expect(usdtToLzt(0)).toBe(0);
  });

  it("pickPlayerBucket respects source and balances", () => {
    expect(pickPlayerBucket("green", 100, 150, 500)).toBe("green");
    expect(pickPlayerBucket("blue", 100, 50, 200)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 50, 200)).toBe("blue");
    expect(pickPlayerBucket("auto", 100, 150, 50)).toBe("green");
    expect(pickPlayerBucket("green", 100, 10, 1000)).toBeNull();
  });

  it("playerCreditAvailableLzt subtracts debt", () => {
    expect(playerCreditAvailableLzt(500, 0)).toBe(500);
    expect(playerCreditAvailableLzt(500, 200)).toBe(300);
    expect(playerCreditAvailableLzt(500, 600)).toBe(0);
  });

  it("pickPlayerFunding falls back to credit line", () => {
    expect(pickPlayerFunding("auto", 100, 0, 0, 500)).toBe("credit");
    expect(pickPlayerFunding("blue", 100, 0, 0, 500)).toBe("credit");
    expect(pickPlayerFunding("green", 100, 0, 0, 500)).toBeNull();
    expect(pickPlayerFunding("auto", 100, 150, 0, 500)).toBe("green");
    expect(pickPlayerFunding("auto", 100, 0, 200, 500)).toBe("blue");
    expect(pickPlayerFunding("auto", 100, 0, 0, 50)).toBeNull();
  });
});
