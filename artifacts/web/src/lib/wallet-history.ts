import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Gamepad2,
  Coins,
  HandCoins,
  Percent,
  Rocket,
  Gift,
  Crown,
  Shield,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export const WALLET_HISTORY_PAGE_SIZE = 15;

export const WALLET_HISTORY_FILTERS = [
  { id: "all", label: "Все" },
  { id: "in", label: "Пополнения" },
  { id: "out", label: "Списания" },
  { id: "debt", label: "Долг" },
] as const;

export type WalletHistoryFilterId = (typeof WALLET_HISTORY_FILTERS)[number]["id"];

type KindMeta = { label: string; icon: LucideIcon; color: string };

export function formatWalletHistoryLzt(lzt: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.trunc(Math.abs(lzt)));
}

export function formatWalletHistoryTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function walletHistoryKindMeta(kind: string, amountLzt: number): KindMeta {
  if (kind.startsWith("deposit_fee"))
    return { label: "Комиссия за пополнение", icon: Percent, color: "#f59e0b" };
  if (kind.startsWith("deposit"))
    return { label: "Пополнение", icon: ArrowDownToLine, color: "#22c55e" };
  if (kind.startsWith("withdrawal"))
    return { label: "Вывод средств", icon: ArrowUpFromLine, color: "#f59e0b" };
  if (kind === "session_tick" || kind === "session_billing")
    return amountLzt >= 0
      ? { label: "Заработок за игру", icon: Coins, color: "#22c55e" }
      : { label: "Игровая минута", icon: Gamepad2, color: "#38bdf8" };
  if (kind === "session_tick_credit" || kind === "host_service_credit")
    return { label: "Заработок хоста", icon: Coins, color: "#22c55e" };
  if (kind === "block_refund")
    return { label: "Возврат за блок", icon: RotateCcw, color: "#22c55e" };
  if (kind === "block_purchase")
    return { label: "Блок тариф", icon: Gamepad2, color: "#38bdf8" };
  if (kind === "platform_credit")
    return { label: "Игра в кредит", icon: HandCoins, color: "#a78bfa" };
  if (kind === "platform_credit_repay")
    return { label: "Погашение кредита платформы", icon: HandCoins, color: "#22c55e" };
  if (kind.startsWith("loan_repay"))
    return { label: "Погашение долга", icon: HandCoins, color: "#a78bfa" };
  if (kind.startsWith("loan_disburse"))
    return { label: "Выдача кредита", icon: HandCoins, color: "#a78bfa" };
  if (kind === "loan_fee")
    return { label: "Комиссия по кредиту", icon: Percent, color: "#f59e0b" };
  if (kind.startsWith("loan_escrow") || kind === "loan_default_release")
    return { label: "Эскроу по кредиту", icon: Shield, color: "#a78bfa" };
  if (kind === "interest_payout")
    return { label: "Проценты", icon: Percent, color: "#22c55e" };
  if (kind === "launch_fee")
    return { label: "Комиссия за запуск", icon: Rocket, color: "#f59e0b" };
  if (kind.startsWith("launch_promo"))
    return { label: "Промо-бонус", icon: Gift, color: "#22c55e" };
  if (kind === "premium_purchase")
    return { label: "Покупка премиума", icon: Crown, color: "#fbbf24" };
  if (kind.startsWith("quota_escrow"))
    return { label: "Эскроу по квоте", icon: Shield, color: "#38bdf8" };
  if (kind === "quota_royalty")
    return { label: "Роялти по квоте", icon: Coins, color: "#22c55e" };
  if (kind.startsWith("quota_sponsor"))
    return { label: "Спонсорство квоты", icon: Gift, color: "#38bdf8" };
  if (kind === "internal_pay")
    return { label: "Внутренний платёж", icon: Coins, color: "#38bdf8" };
  return { label: kind, icon: Coins, color: "#94a3b8" };
}

export function walletHistoryBucketMeta(bucket: string | null | undefined): {
  label: string;
  color: string;
} | null {
  switch (bucket) {
    case "cash":
      return { label: "К выводу", color: "#22c55e" };
    case "balance":
      return { label: "Игровой", color: "#38bdf8" };
    case "debt":
      return { label: "Долг", color: "#f87171" };
    case "escrow":
      return { label: "Эскроу", color: "#a78bfa" };
    default:
      return null;
  }
}

export function isWalletHistoryDebtTx(
  kind: string,
  bucket: string | null | undefined,
): boolean {
  return (
    bucket === "debt" || kind.startsWith("loan_") || kind === "interest_payout"
  );
}

export type WalletHistoryTx = {
  id?: string;
  kind: string;
  bucket?: string | null;
  amountLzt?: number | null;
  timestamp?: string | Date;
  description?: string | null;
};

export function filterWalletHistoryByFilter<T extends WalletHistoryTx>(
  txs: T[],
  filter: WalletHistoryFilterId,
): T[] {
  return txs.filter((tx) => {
    const amount = tx.amountLzt ?? 0;
    switch (filter) {
      case "in":
        return amount > 0;
      case "out":
        return amount < 0;
      case "debt":
        return isWalletHistoryDebtTx(tx.kind, tx.bucket);
      default:
        return true;
    }
  });
}
