import { test } from "node:test";
import assert from "node:assert/strict";

const {
  formatWalletHistoryLzt,
  walletHistoryKindMeta,
  walletHistoryBucketMeta,
  isWalletHistoryDebtTx,
  WALLET_HISTORY_FILTERS,
  WALLET_HISTORY_PAGE_SIZE,
} = await import("../src/components/wallet-history.tsx");

test("formatWalletHistoryLzt formats absolute truncated balance in ru-RU", () => {
  assert.equal(formatWalletHistoryLzt(1234.9), "1\u00a0234");
  assert.equal(formatWalletHistoryLzt(-5678), "5\u00a0678");
  assert.equal(formatWalletHistoryLzt(0), "0");
  assert.equal(formatWalletHistoryLzt(1_000_000), "1\u00a0000\u00a0000");
});

test("WALLET_HISTORY_FILTERS lists Russian filter labels", () => {
  assert.deepEqual(
    WALLET_HISTORY_FILTERS.map((f) => f.id),
    ["all", "in", "out", "debt"],
  );
  assert.equal(WALLET_HISTORY_FILTERS[0].label, "Все");
  assert.equal(WALLET_HISTORY_FILTERS[1].label, "Пополнения");
  assert.equal(WALLET_HISTORY_FILTERS[2].label, "Списания");
  assert.equal(WALLET_HISTORY_FILTERS[3].label, "Долг");
});

test("WALLET_HISTORY_PAGE_SIZE is 15", () => {
  assert.equal(WALLET_HISTORY_PAGE_SIZE, 15);
});

test("walletHistoryKindMeta maps deposit and withdrawal kinds", () => {
  assert.equal(walletHistoryKindMeta("deposit", 100).label, "Пополнение");
  assert.equal(walletHistoryKindMeta("deposit_fee", -5).label, "Комиссия за пополнение");
  assert.equal(walletHistoryKindMeta("withdrawal", -200).label, "Вывод средств");
});

test("walletHistoryKindMeta distinguishes session billing by sign", () => {
  assert.equal(walletHistoryKindMeta("session_tick", 50).label, "Заработок за игру");
  assert.equal(walletHistoryKindMeta("session_tick", -10).label, "Игровая минута");
  assert.equal(walletHistoryKindMeta("session_billing", -3).label, "Игровая минута");
});

test("walletHistoryKindMeta maps loan, premium and quota kinds", () => {
  assert.equal(walletHistoryKindMeta("loan_disburse", 500).label, "Выдача кредита");
  assert.equal(walletHistoryKindMeta("loan_repay", -100).label, "Погашение долга");
  assert.equal(walletHistoryKindMeta("loan_escrow_hold", 0).label, "Эскроу по кредиту");
  assert.equal(walletHistoryKindMeta("premium_purchase", -99).label, "Покупка премиума");
  assert.equal(walletHistoryKindMeta("quota_royalty", 10).label, "Роялти по квоте");
  assert.equal(walletHistoryKindMeta("launch_promo_bonus", 5).label, "Промо-бонус");
});

test("walletHistoryKindMeta falls back to raw kind for unknown types", () => {
  const meta = walletHistoryKindMeta("custom_event_xyz", 1);
  assert.equal(meta.label, "custom_event_xyz");
  assert.equal(meta.color, "#94a3b8");
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
  assert.equal(walletHistoryBucketMeta("unknown"), null);
});

test("isWalletHistoryDebtTx detects debt bucket, loan kinds and interest", () => {
  assert.equal(isWalletHistoryDebtTx("deposit", "debt"), true);
  assert.equal(isWalletHistoryDebtTx("loan_disburse", "balance"), true);
  assert.equal(isWalletHistoryDebtTx("loan_repay", null), true);
  assert.equal(isWalletHistoryDebtTx("interest_payout", "cash"), true);
  assert.equal(isWalletHistoryDebtTx("deposit", "cash"), false);
  assert.equal(isWalletHistoryDebtTx("session_tick", "balance"), false);
});
