import { afterEach, describe, expect, it } from "vitest";
import {
  nativeUnitsToUsdtCents,
  parseEnvUsdRate,
  resetDepositFxCacheForTests,
  toUsdtCents,
} from "./depositFx";

describe("depositFx", () => {
  afterEach(() => {
    delete process.env.DEPOSIT_SOL_USD_RATE;
    delete process.env.DEPOSIT_NANO_USD_RATE;
    resetDepositFxCacheForTests();
  });

  it("converts USDT float to cents", () => {
    expect(toUsdtCents(1)).toBe(100);
    expect(toUsdtCents(1.234)).toBe(123);
    expect(toUsdtCents(0)).toBe(0);
  });

  it("converts native SOL units using USD rate (not 1:1)", () => {
    // 1 SOL @ $150 → $150 → 15000¢
    expect(nativeUnitsToUsdtCents(1, 150)).toBe(15_000);
    // 0.05 SOL @ $200 → $10 → 1000¢
    expect(nativeUnitsToUsdtCents(0.05, 200)).toBe(1000);
    // Regression: must NOT treat 1 SOL as $1
    expect(nativeUnitsToUsdtCents(1, 1)).toBe(100);
    expect(nativeUnitsToUsdtCents(1, 150)).not.toBe(100);
  });

  it("returns zero cents when USD rate is missing or invalid", () => {
    expect(nativeUnitsToUsdtCents(1, 0)).toBe(0);
    expect(nativeUnitsToUsdtCents(1, Number.NaN)).toBe(0);
  });

  it("reads DEPOSIT_SOL_USD_RATE from env", () => {
    process.env.DEPOSIT_SOL_USD_RATE = "123.45";
    expect(parseEnvUsdRate("SOL")).toBe(123.45);
    expect(parseEnvUsdRate("NANO")).toBeNull();
  });
});
