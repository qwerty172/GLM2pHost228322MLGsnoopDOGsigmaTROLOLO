import { test } from "node:test";
import assert from "node:assert/strict";

const {
  WALLET_HISTORY_FILTERS,
  WALLET_HISTORY_PAGE_SIZE,
  formatWalletHistoryLzt,
  formatWalletHistoryTs,
  walletHistoryKindMeta,
  walletHistoryBucketMeta,
  isWalletHistoryDebtTx,
} = await import("../src/components/wallet-history.tsx");

test("WALLET_HISTORY_FILTERS lists all filter tabs in Russian", () => {
  assert.deepEqual(WALLET_HISTORY_FILTERS.map((f) => f.id), ["all", "in", "out", "debt"]);
  assert.deepEqual(WALLET_HISTORY_FILTERS.map((f) => f.label), [
    "Все",
    "Пополнения",
    "Списания",
    "Долг",
  ]);
});

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("formatWalletHistoryLzt formats truncated absolute value in ru-RU", () => {
  assert.equal(formatWalletHistoryLzt(1234.9), "1\u00a0234");
  assert.equal(formatWalletHistoryLzt(-5000), "5\u00a0000");
  assert.equal(formatWalletHistoryLzt(0), "0");
});

test("formatWalletHistoryTs formats ISO timestamp in ru-RU locale", () => {
  const formatted = formatWalletHistoryTs("2026-01-15T14:30:00.000Z");
  assert.match(formatted, /15\.01\.26/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test("walletHistoryKindMeta maps deposit and withdrawal kinds", () => {
  assert.equal(walletHistoryKindMeta("deposit", 100).label, "Пополнение");
  assert.equal(walletHistoryKindMeta("deposit_fee", -5).label, "Комиссия за пополнение");
  assert.equal(walletHistoryKindMeta("withdrawal", -200).label, "Вывод средств");
});

test("walletHistoryKindMeta distinguishes session billing by sign", () => {
  assert.equal(walletHistoryKindMeta("session_tick", 10).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("session_tick", -10).label, "Игровая минута");
  assert.equal(walletHistoryKindMeta("session_billing", 5).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("session_billing", -5).label, "Игровая минута");
});

test("walletHistoryKindMeta maps loan and premium kinds", () => {
  assert.equal(walletHistoryKindMeta("loan_disburse", 1000).label, "Выдача кредита");
  assert.equal(walletHistoryKindMeta("loan_repay", -500).label, "Погашение долга");
  assert.equal(walletHistoryKindMeta("premium_purchase", -99).label, "Покупка премиума");
  assert.equal(walletHistoryKindMeta("unknown_kind_xyz", 0).label, "unknown_kind_xyz");
});

test("walletHistoryBucketMeta maps wallet buckets to Russian labels", () => {
  assert.deepEqual(walletHistoryBucketMeta("cash"), { label: "К выводу", color: "#22c55e" });
  assert.deepEqual(walletHistoryBucketMeta("balance"), { label: "Игровой", color: "#38bdf8" });
  assert.deepEqual(walletHistoryBucketMeta("debt"), { label: "Долг", color: "#f87171" });
  assert.deepEqual(walletHistoryBucketMeta("escrow"), { label: "Эскроу", color: "#a78bfa" });
  assert.equal(walletHistoryBucketMeta(null), null);
  assert.equal(walletHistoryBucketMeta("other"), null);
});

test("isWalletHistoryDebtTx detects debt bucket and loan kinds", () => {
  assert.equal(isWalletHistoryDebtTx("deposit", "debt"), true);
  assert.equal(isWalletHistoryDebtTx("loan_disburse", "balance"), true);
  assert.equal(isWalletHistoryDebtTx("loan_repay_host", null), true);
  assert.equal(isWalletHistoryDebtTx("interest_payout", "cash"), true);
  assert.equal(isWalletHistoryDebtTx("deposit", "cash"), false);
  assert.equal(isWalletHistoryDebtTx("session_tick", "balance"), false);
});
