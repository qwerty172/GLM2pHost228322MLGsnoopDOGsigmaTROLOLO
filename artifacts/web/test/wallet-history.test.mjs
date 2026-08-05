import { test } from "node:test";
import assert from "node:assert/strict";

const {
  formatLzt,
  formatTs,
  kindMeta,
  bucketMeta,
  isDebtTx,
  WALLET_HISTORY_FILTERS,
  WALLET_HISTORY_PAGE_SIZE,
} = await import("../src/components/wallet-history.tsx");

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("WALLET_HISTORY_FILTERS lists four Russian filter tabs", () => {
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.id),
    ["all", "in", "out", "debt"],
  );
  assert.equal(WALLET_HISTORY_FILTERS[0].label, "Все");
  assert.equal(WALLET_HISTORY_FILTERS[1].label, "Пополнения");
  assert.equal(WALLET_HISTORY_FILTERS[2].label, "Списания");
  assert.equal(WALLET_HISTORY_FILTERS[3].label, "Долг");
});

test("formatLzt formats absolute LZT amounts in ru-RU locale", () => {
  assert.equal(formatLzt(1500), "1\u00a0500");
  assert.equal(formatLzt(-2500), "2\u00a0500");
  assert.equal(formatLzt(0), "0");
});

test("formatTs formats ISO timestamps in ru-RU locale", () => {
  const formatted = formatTs("2026-01-15T14:30:00.000Z");
  assert.match(formatted, /15\.01\.26/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test("kindMeta maps known transaction kinds to Russian labels", () => {
  assert.equal(kindMeta("deposit", 100).label, "Пополнение");
  assert.equal(kindMeta("deposit_fee", -5).label, "Комиссия за пополнение");
  assert.equal(kindMeta("withdrawal", -200).label, "Вывод средств");
  assert.equal(kindMeta("session_tick", 50).label, "Заработок за игру");
  assert.equal(kindMeta("session_tick", -10).label, "Игровая минута");
  assert.equal(kindMeta("block_refund", 30).label, "Возврат за блок");
  assert.equal(kindMeta("premium_purchase", -99).label, "Покупка премиума");
  assert.equal(kindMeta("unknown_kind_xyz", 1).label, "unknown_kind_xyz");
});

test("kindMeta assigns distinct colors for income vs expense kinds", () => {
  assert.equal(kindMeta("deposit", 100).color, "#22c55e");
  assert.equal(kindMeta("session_tick", -10).color, "#38bdf8");
  assert.equal(kindMeta("withdrawal", -50).color, "#f59e0b");
});

test("bucketMeta maps wallet buckets to Russian labels", () => {
  assert.deepEqual(bucketMeta("cash"), { label: "К выводу", color: "#22c55e" });
  assert.deepEqual(bucketMeta("balance"), { label: "Игровой", color: "#38bdf8" });
  assert.deepEqual(bucketMeta("debt"), { label: "Долг", color: "#f87171" });
  assert.deepEqual(bucketMeta("escrow"), { label: "Эскроу", color: "#a78bfa" });
  assert.equal(bucketMeta(null), null);
  assert.equal(bucketMeta("unknown"), null);
});

test("isDebtTx detects debt bucket, loan kinds and interest payouts", () => {
  assert.equal(isDebtTx("deposit", "debt"), true);
  assert.equal(isDebtTx("loan_disburse", "balance"), true);
  assert.equal(isDebtTx("loan_repay_partial", "cash"), true);
  assert.equal(isDebtTx("interest_payout", "balance"), true);
  assert.equal(isDebtTx("deposit", "cash"), false);
  assert.equal(isDebtTx("session_tick", "balance"), false);
});
