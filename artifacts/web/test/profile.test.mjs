import { test } from "node:test";
import assert from "node:assert/strict";

const {
  LZT_PER_USDT,
  PROFILE_HISTORY_PAGE_SIZE,
  formatLzt,
  formatMinutes,
  formatTs,
  kindLabel,
  getProfileValidTabs,
  resolveProfileDefaultTab,
  vdsStatusMeta,
  computeAvgSessionMinutes,
  computeHostEarningsLzt,
  enrichTransactionsWithBalances,
  isAgentFresh,
  resolveAgentPresence,
  computeCreditAvailable,
  isCreditEnabled,
} = await import("../src/pages/profile-helpers.ts");

test("LZT_PER_USDT and PROFILE_HISTORY_PAGE_SIZE are stable", () => {
  assert.equal(LZT_PER_USDT, 200);
  assert.equal(PROFILE_HISTORY_PAGE_SIZE, 20);
});

test("formatLzt formats truncated integers in ru-RU locale", () => {
  assert.equal(formatLzt(1234.9), "1\u00a0234");
  assert.match(formatLzt(-5000), /5\u00a0000/);
  assert.equal(formatLzt(0), "0");
});

test("formatMinutes formats minutes and hours in Russian", () => {
  assert.equal(formatMinutes(45), "45 мин");
  assert.equal(formatMinutes(60), "1 ч");
  assert.equal(formatMinutes(90), "1 ч 30 мин");
  assert.equal(formatMinutes(120), "2 ч");
});

test("formatTs formats ISO timestamp in ru-RU locale", () => {
  const formatted = formatTs("2026-01-15T14:30:00.000Z");
  assert.match(formatted, /15\.01\.26/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test("kindLabel maps transaction kinds to Russian labels", () => {
  assert.equal(kindLabel("deposit_card").label, "Пополнение");
  assert.equal(kindLabel("withdrawal").label, "Вывод");
  assert.equal(kindLabel("session_billing").label, "Сессия");
  assert.equal(kindLabel("loan_disburse").label, "Кредит");
  assert.equal(kindLabel("loan_repay_host").label, "Погашение");
  assert.equal(kindLabel("interest_payout").label, "Проценты");
  assert.equal(kindLabel("premium_purchase").label, "Премиум");
  assert.equal(kindLabel("custom_kind").label, "custom_kind");
});

test("getProfileValidTabs returns host and player tab sets", () => {
  assert.deepEqual(getProfileValidTabs(true), ["stats", "history", "account", "vds"]);
  assert.deepEqual(getProfileValidTabs(false), ["history", "account"]);
});

test("resolveProfileDefaultTab respects tab query param when valid", () => {
  assert.equal(resolveProfileDefaultTab("?tab=account", true), "account");
  assert.equal(resolveProfileDefaultTab("?tab=stats", true), "stats");
  assert.equal(resolveProfileDefaultTab("?tab=stats", false), "history");
  assert.equal(resolveProfileDefaultTab("?tab=unknown", true), "history");
  assert.equal(resolveProfileDefaultTab("", false), "history");
});

test("vdsStatusMeta maps known VDS statuses", () => {
  assert.equal(vdsStatusMeta("online").label, "Онлайн");
  assert.equal(vdsStatusMeta("offline").label, "Офлайн");
  assert.equal(vdsStatusMeta("pending").label, "Ожидание");
  assert.equal(vdsStatusMeta("provisioning").label, "Настройка…");
  assert.equal(vdsStatusMeta("error").label, "Ошибка");
  assert.equal(vdsStatusMeta("custom").label, "custom");
});

test("computeAvgSessionMinutes averages streamed minutes per session", () => {
  assert.equal(computeAvgSessionMinutes(300, 10), 30);
  assert.equal(computeAvgSessionMinutes(100, 0), 0);
});

test("computeHostEarningsLzt converts USD earnings to LZT", () => {
  assert.deepEqual(computeHostEarningsLzt(10.5, 2.25), {
    lifetimeLzt: 2100,
    earnings7dLzt: 450,
  });
});

test("enrichTransactionsWithBalances computes running balances newest-first", () => {
  const txs = [
    { id: "t1", amountLzt: -100 },
    { id: "t2", amountLzt: 500 },
    { id: "t3", amountLzt: -200 },
  ];
  const enriched = enrichTransactionsWithBalances(txs, 1000);
  assert.equal(enriched[0].balanceAfter, 1000);
  assert.equal(enriched[0].balanceBefore, 1100);
  assert.equal(enriched[1].balanceAfter, 1100);
  assert.equal(enriched[1].balanceBefore, 600);
  assert.equal(enriched[2].balanceAfter, 600);
  assert.equal(enriched[2].balanceBefore, 800);
});

test("isAgentFresh treats heartbeat within 2 minutes as online", () => {
  const now = Date.parse("2026-08-05T12:00:00.000Z");
  assert.equal(isAgentFresh("2026-08-05T11:59:00.000Z", now), true);
  assert.equal(isAgentFresh("2026-08-05T11:57:59.000Z", now), false);
  assert.equal(isAgentFresh(null, now), false);
});

test("resolveAgentPresence maps host token and lastSeenAt to presence state", () => {
  const now = Date.parse("2026-08-05T12:00:00.000Z");
  assert.equal(resolveAgentPresence(null, null, now), "no_host");
  assert.equal(resolveAgentPresence("tok", "2026-08-05T11:59:30.000Z", now), "online");
  assert.equal(resolveAgentPresence("tok", "2026-08-05T11:00:00.000Z", now), "offline");
  assert.equal(resolveAgentPresence("tok", null, now), "unbound");
});

test("computeCreditAvailable and isCreditEnabled handle credit limits", () => {
  assert.equal(computeCreditAvailable(1000, 300), 700);
  assert.equal(computeCreditAvailable(500, 800), 0);
  assert.equal(isCreditEnabled(1), true);
  assert.equal(isCreditEnabled(0), false);
});
