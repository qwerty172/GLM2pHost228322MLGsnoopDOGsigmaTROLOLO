import { test } from "node:test";
import assert from "node:assert/strict";

const {
  WALLET_HISTORY_PAGE_SIZE,
  WALLET_HISTORY_FILTERS,
  formatWalletHistoryLzt,
  formatWalletHistoryTimestamp,
  walletHistoryKindMeta,
  walletHistoryBucketMeta,
  isWalletHistoryDebtTx,
  filterWalletHistoryByFilter,
} = await import("../src/lib/wallet-history.ts");

const sampleTxs = [
  { id: "1", kind: "deposit", bucket: "balance", amountLzt: 500 },
  { id: "2", kind: "session_tick", bucket: "balance", amountLzt: -120 },
  { id: "3", kind: "loan_disburse", bucket: "debt", amountLzt: 1000 },
  { id: "4", kind: "interest_payout", bucket: "balance", amountLzt: 50 },
];

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("WALLET_HISTORY_FILTERS lists four Russian filter labels", () => {
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.id),
    ["all", "in", "out", "debt"],
  );
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.label),
    ["Все", "Пополнения", "Списания", "Долг"],
  );
});

test("formatWalletHistoryLzt formats absolute truncated amount in ru-RU", () => {
  assert.equal(formatWalletHistoryLzt(1234.9), "1\u00a0234");
  assert.equal(formatWalletHistoryLzt(-9876), "9\u00a0876");
  assert.equal(formatWalletHistoryLzt(0), "0");
});

test("formatWalletHistoryTimestamp formats ISO string in ru-RU locale", () => {
  const formatted = formatWalletHistoryTimestamp("2026-03-15T14:30:00.000Z");
  assert.match(formatted, /15\.03\.26/);
  assert.match(formatted, /\d{2}:\d{2}/);
});

test("walletHistoryKindMeta maps deposit and withdrawal kinds", () => {
  assert.equal(walletHistoryKindMeta("deposit", 100).label, "Пополнение");
  assert.equal(walletHistoryKindMeta("deposit_fee", -5).label, "Комиссия за пополнение");
  assert.equal(walletHistoryKindMeta("withdrawal", -200).label, "Вывод средств");
});

test("walletHistoryKindMeta distinguishes session billing by sign", () => {
  assert.equal(walletHistoryKindMeta("session_tick", 80).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("session_tick", -80).label, "Игровая минута");
  assert.equal(walletHistoryKindMeta("session_billing", -10).label, "Игровая минута");
});

test("walletHistoryKindMeta maps loan and premium kinds", () => {
  assert.equal(walletHistoryKindMeta("loan_disburse", 500).label, "Выдача кредита");
  assert.equal(walletHistoryKindMeta("loan_repay", -100).label, "Погашение долга");
  assert.equal(walletHistoryKindMeta("premium_purchase", -300).label, "Покупка премиума");
  assert.equal(walletHistoryKindMeta("unknown_kind", 1).label, "unknown_kind");
});

test("walletHistoryBucketMeta maps known buckets to Russian labels", () => {
  assert.deepEqual(walletHistoryBucketMeta("cash"), {
    label: "К выводу",
    color: "#22c55e",
  });
  assert.deepEqual(walletHistoryBucketMeta("balance"), {
    label: "Игровой",
    color: "#38bdf8",
  });
  assert.deepEqual(walletHistoryBucketMeta("debt"), {
    label: "Долг",
    color: "#f87171",
  });
  assert.deepEqual(walletHistoryBucketMeta("escrow"), {
    label: "Эскроу",
    color: "#a78bfa",
  });
  assert.equal(walletHistoryBucketMeta(null), null);
  assert.equal(walletHistoryBucketMeta("other"), null);
});

test("isWalletHistoryDebtTx detects debt bucket, loan kinds and interest", () => {
  assert.equal(isWalletHistoryDebtTx("deposit", "balance"), false);
  assert.equal(isWalletHistoryDebtTx("loan_disburse", "balance"), true);
  assert.equal(isWalletHistoryDebtTx("deposit", "debt"), true);
  assert.equal(isWalletHistoryDebtTx("interest_payout", "balance"), true);
});

test("filterWalletHistoryByFilter filters in, out and debt transactions", () => {
  assert.deepEqual(
    filterWalletHistoryByFilter(sampleTxs, "all").map((tx) => tx.id),
    ["1", "2", "3", "4"],
  );
  assert.deepEqual(
    filterWalletHistoryByFilter(sampleTxs, "in").map((tx) => tx.id),
    ["1", "3", "4"],
  );
  assert.deepEqual(
    filterWalletHistoryByFilter(sampleTxs, "out").map((tx) => tx.id),
    ["2"],
  );
  assert.deepEqual(
    filterWalletHistoryByFilter(sampleTxs, "debt").map((tx) => tx.id),
    ["3", "4"],
  );
});
