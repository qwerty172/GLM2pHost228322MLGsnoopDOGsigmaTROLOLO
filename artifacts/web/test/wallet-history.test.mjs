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
} = await import("../src/components/wallet-history.tsx");

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("WALLET_HISTORY_FILTERS lists Russian filter labels", () => {
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.label),
    ["Все", "Пополнения", "Списания", "Долг"],
  );
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.id),
    ["all", "in", "out", "debt"],
  );
});

test("formatWalletHistoryLzt formats absolute truncated balance in ru-RU", () => {
  assert.equal(formatWalletHistoryLzt(1234.9), "1\u00a0234");
  assert.equal(formatWalletHistoryLzt(-5678), "5\u00a0678");
  assert.equal(formatWalletHistoryLzt(0), "0");
});

test("formatWalletHistoryTimestamp formats ISO date in ru-RU locale", () => {
  const formatted = formatWalletHistoryTimestamp("2026-01-15T14:30:00.000Z");
  assert.match(formatted, /15/);
  assert.match(formatted, /01/);
  assert.match(formatted, /26/);
});

test("walletHistoryKindMeta maps common transaction kinds to Russian labels", () => {
  assert.equal(walletHistoryKindMeta("deposit", 100).label, "Пополнение");
  assert.equal(walletHistoryKindMeta("deposit_fee", -5).label, "Комиссия за пополнение");
  assert.equal(walletHistoryKindMeta("withdrawal", -200).label, "Вывод средств");
  assert.equal(walletHistoryKindMeta("session_tick", 50).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("session_tick", -10).label, "Игровая минута");
  assert.equal(walletHistoryKindMeta("block_refund", 30).label, "Возврат за блок");
  assert.equal(walletHistoryKindMeta("premium_purchase", -500).label, "Покупка премиума");
  assert.equal(walletHistoryKindMeta("unknown_kind", 1).label, "unknown_kind");
});

test("walletHistoryBucketMeta maps wallet buckets to Russian labels", () => {
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

test("isWalletHistoryDebtTx detects debt bucket, loan kinds and interest payouts", () => {
  assert.equal(isWalletHistoryDebtTx("deposit", "debt"), true);
  assert.equal(isWalletHistoryDebtTx("loan_disburse", "balance"), true);
  assert.equal(isWalletHistoryDebtTx("loan_repay_partial", "cash"), true);
  assert.equal(isWalletHistoryDebtTx("interest_payout", "cash"), true);
  assert.equal(isWalletHistoryDebtTx("deposit", "cash"), false);
  assert.equal(isWalletHistoryDebtTx("session_tick", "balance"), false);
});
