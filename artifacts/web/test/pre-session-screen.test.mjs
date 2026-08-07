import { test } from "node:test";
import assert from "node:assert/strict";

const {
  PRE_SESSION_DEFAULT_CREDIT_LZT,
  PRE_SESSION_TARGET_MINS,
  PRE_SESSION_BLOCK_OPTIONS,
  PreSessionScreen,
  resolveInitialBlockChoice,
  computePreSessionWalletTotals,
  computeSelectedBlockMins,
  computePreSessionCanStart,
  getPreSessionMinsAvailableColor,
  formatPreSessionMinsDisplay,
  formatPreSessionPriceLabel,
  getPreSessionStartButtonLabel,
  isPreSessionBlockOptionAffordable,
  computePreSessionTargetCostLzt,
  computePreSessionShortfallLzt,
  needsPreSessionInlineTopUp,
  formatPreSessionShortfallHint,
} = await import("../src/components/pre-session-screen.tsx");

test("PRE_SESSION_DEFAULT_CREDIT_LZT is 3000", () => {
  assert.equal(PRE_SESSION_DEFAULT_CREDIT_LZT, 3000);
});

test("PRE_SESSION_BLOCK_OPTIONS lists 10, 15 and 25 minute blocks", () => {
  assert.deepEqual(
    PRE_SESSION_BLOCK_OPTIONS.map((opt) => opt.mins),
    [10, 15, 25],
  );
  assert.deepEqual(
    PRE_SESSION_BLOCK_OPTIONS.map((opt) => opt.label),
    ["10 мин", "15 мин", "25 мин"],
  );
});

test("resolveInitialBlockChoice maps initial block minutes", () => {
  assert.equal(resolveInitialBlockChoice(10), "10");
  assert.equal(resolveInitialBlockChoice(15), "15");
  assert.equal(resolveInitialBlockChoice(25), "25");
  assert.equal(resolveInitialBlockChoice(undefined), "unlimited");
});

test("computePreSessionWalletTotals sums balances and credit headroom", () => {
  assert.deepEqual(computePreSessionWalletTotals(), {
    balanceLzt: 0,
    totalAvailableLzt: 0,
    creditLimit: 3000,
    creditUsed: 0,
    creditAvailable: 3000,
  });
  assert.deepEqual(
    computePreSessionWalletTotals({
      internalBalanceLzt: 100,
      withdrawableBalanceLzt: 50,
      creditDebtLzt: 500,
      creditLimitLzt: 2000,
    }),
    {
      balanceLzt: 150,
      totalAvailableLzt: 150,
      creditLimit: 2000,
      creditUsed: 500,
      creditAvailable: 1500,
    },
  );
});

test("computeSelectedBlockMins returns null for unlimited choice", () => {
  assert.equal(computeSelectedBlockMins("unlimited"), null);
  assert.equal(computeSelectedBlockMins("15"), 15);
});

test("computePreSessionCanStart requires balance, affordable block and non-test session", () => {
  assert.equal(computePreSessionCanStart(false, 10, true, false), true);
  assert.equal(computePreSessionCanStart(true, 10, true, false), false);
  assert.equal(computePreSessionCanStart(false, 0, true, false), false);
  assert.equal(computePreSessionCanStart(false, 10, false, false), false);
  assert.equal(computePreSessionCanStart(false, 10, true, true), false);
});

test("getPreSessionMinsAvailableColor uses green, yellow and red thresholds", () => {
  assert.equal(getPreSessionMinsAvailableColor(60), "#2dd4bf");
  assert.equal(getPreSessionMinsAvailableColor(30), "#2dd4bf");
  assert.equal(getPreSessionMinsAvailableColor(10), "#eab308");
  assert.equal(getPreSessionMinsAvailableColor(5), "#eab308");
  assert.equal(getPreSessionMinsAvailableColor(4), "#ef4444");
});

test("formatPreSessionMinsDisplay shows infinity for very large values", () => {
  assert.equal(formatPreSessionMinsDisplay(9999), "∞");
  assert.equal(formatPreSessionMinsDisplay(90, (m) => `${m}m`), "90m");
});

test("formatPreSessionPriceLabel handles test and paid sessions", () => {
  assert.deepEqual(formatPreSessionPriceLabel(true, 8), {
    price: "0",
    subtitle: "бесплатно",
  });
  assert.deepEqual(formatPreSessionPriceLabel(false, 10), {
    price: "10",
    subtitle: "в минуту · 600 LZT/час",
  });
});

test("getPreSessionStartButtonLabel reserves block cost when selected", () => {
  assert.equal(getPreSessionStartButtonLabel(null), "Начать игру");
  assert.equal(
    getPreSessionStartButtonLabel(1500),
    "Зарезервировать 1\u00a0500 LZT и начать",
  );
});

test("isPreSessionBlockOptionAffordable compares block cost to balance", () => {
  assert.equal(isPreSessionBlockOptionAffordable(100, 10, 8), true);
  assert.equal(isPreSessionBlockOptionAffordable(79, 10, 8), false);
});

test("PRE_SESSION_TARGET_MINS is 30 (U-46)", () => {
  assert.equal(PRE_SESSION_TARGET_MINS, 30);
});

test("computePreSessionTargetCostLzt multiplies price by target minutes", () => {
  assert.equal(computePreSessionTargetCostLzt(10), 300);
  assert.equal(computePreSessionTargetCostLzt(8, 15), 120);
});

test("computePreSessionShortfallLzt returns deficit for 30-minute play", () => {
  assert.equal(computePreSessionShortfallLzt(100, 10), 200);
  assert.equal(computePreSessionShortfallLzt(300, 10), 0);
});

test("needsPreSessionInlineTopUp when under 30 minutes or block unaffordable", () => {
  assert.equal(needsPreSessionInlineTopUp(29, true), true);
  assert.equal(needsPreSessionInlineTopUp(30, true), false);
  assert.equal(needsPreSessionInlineTopUp(60, false), true);
});

test("formatPreSessionShortfallHint explains 30-minute need in Russian (U-46)", () => {
  assert.match(
    formatPreSessionShortfallHint(50, 10),
    /На 30 минут нужно 300 LZT — не хватает 250 LZT/,
  );
  assert.match(
    formatPreSessionShortfallHint(400, 10),
    /баланс достаточен/,
  );
});

test("PreSessionScreen is a React component", () => {
  assert.equal(typeof PreSessionScreen, "function");
});
