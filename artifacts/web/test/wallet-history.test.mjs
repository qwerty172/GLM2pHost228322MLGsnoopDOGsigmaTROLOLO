import { test } from "node:test";
import assert from "node:assert/strict";

const {
  WALLET_HISTORY_PAGE_SIZE,
  WALLET_HISTORY_FILTERS,
  formatWalletHistoryLzt,
  formatWalletHistoryTs,
  walletHistoryKindMeta,
  walletHistoryBucketMeta,
  isWalletHistoryDebtTx,
  filterWalletHistoryTransactions,
  walletHistoryEmptyMessage,
} = await import("../src/components/wallet-history.tsx");

const sampleTxs = [
  { id: "1", kind: "deposit", amountLzt: 500, bucket: "balance" },
  { id: "2", kind: "session_tick", amountLzt: -120, bucket: "balance" },
  { id: "3", kind: "loan_disburse", amountLzt: 1000, bucket: "debt" },
  { id: "4", kind: "interest_payout", amountLzt: -50, bucket: "balance" },
];

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("WALLET_HISTORY_FILTERS lists four Russian filter labels", () => {
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.label),
    ["Все", "Пополнения", "Списания", "Долг"],
  );
  assert.equal(WALLET_HISTORY_FILTERS.length, 4);
});

test("formatWalletHistoryLzt formats absolute truncated amounts in ru-RU", () => {
  assert.equal(formatWalletHistoryLzt(1234.9), "1\u00a0234");
  assert.equal(formatWalletHistoryLzt(-5678), "5\u00a0678");
  assert.equal(formatWalletHistoryLzt(0), "0");
});

test("formatWalletHistoryTs formats ISO timestamps in ru-RU locale", () => {
  const formatted = formatWalletHistoryTs("2026-01-15T14:30:00.000Z");
  assert.match(formatted, /15\.01\.26/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test("walletHistoryKindMeta maps common transaction kinds to Russian labels", () => {
  assert.equal(walletHistoryKindMeta("deposit", 100).label, "Пополнение");
  assert.equal(walletHistoryKindMeta("withdrawal", -50).label, "Вывод средств");
  assert.equal(walletHistoryKindMeta("deposit_fee", -10).label, "Комиссия за пополнение");
  assert.equal(walletHistoryKindMeta("session_tick", -60).label, "Игровая минута");
  assert.equal(walletHistoryKindMeta("session_tick", 60).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("premium_purchase", -500).label, "Покупка премиума");
  assert.equal(walletHistoryKindMeta("unknown_kind", 1).label, "unknown_kind");
});

test("walletHistoryBucketMeta maps bucket codes to Russian labels", () => {
  assert.deepEqual(walletHistoryBucketMeta("cash"), { label: "К выводу", color: "#22c55e" });
  assert.deepEqual(walletHistoryBucketMeta("balance"), { label: "Игровой", color: "#38bdf8" });
  assert.deepEqual(walletHistoryBucketMeta("debt"), { label: "Долг", color: "#f87171" });
  assert.deepEqual(walletHistoryBucketMeta("escrow"), { label: "Эскроу", color: "#a78bfa" });
  assert.equal(walletHistoryBucketMeta(null), null);
  assert.equal(walletHistoryBucketMeta("other"), null);
});

test("isWalletHistoryDebtTx detects debt bucket, loan kinds and interest payouts", () => {
  assert.equal(isWalletHistoryDebtTx("deposit", "balance"), false);
  assert.equal(isWalletHistoryDebtTx("loan_disburse", "balance"), true);
  assert.equal(isWalletHistoryDebtTx("deposit", "debt"), true);
  assert.equal(isWalletHistoryDebtTx("interest_payout", "balance"), true);
});

test("filterWalletHistoryTransactions filters by direction and debt", () => {
  assert.equal(filterWalletHistoryTransactions(sampleTxs, "all").length, 4);
  assert.deepEqual(
    filterWalletHistoryTransactions(sampleTxs, "in").map((tx) => tx.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterWalletHistoryTransactions(sampleTxs, "out").map((tx) => tx.id),
    ["2", "4"],
  );
  assert.deepEqual(
    filterWalletHistoryTransactions(sampleTxs, "debt").map((tx) => tx.id),
    ["3", "4"],
  );
});

test("walletHistoryEmptyMessage returns Russian empty-state copy", () => {
  assert.equal(walletHistoryEmptyMessage("all"), "Операций пока нет.");
  assert.equal(walletHistoryEmptyMessage("in"), "Нет операций по выбранному фильтру.");
});
