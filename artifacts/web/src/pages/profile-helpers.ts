export const LZT_PER_USDT = 200;
export const PROFILE_HISTORY_PAGE_SIZE = 20;

const AGENT_ONLINE_THRESHOLD_MS = 2 * 60_000;

export type ProfileTab = "stats" | "history" | "account" | "vds";
export type AgentPresence = "no_host" | "online" | "offline" | "unbound";

export function formatLzt(lzt: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.trunc(lzt));
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

export function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function kindLabel(kind: string): { label: string; color: string } {
  if (kind.startsWith("deposit")) return { label: "Пополнение", color: "#22c55e" };
  if (kind === "withdrawal") return { label: "Вывод", color: "#f59e0b" };
  if (kind.includes("session") || kind === "session_billing")
    return { label: "Сессия", color: "#38bdf8" };
  if (kind.startsWith("loan_disburse")) return { label: "Кредит", color: "#a78bfa" };
  if (kind.startsWith("loan_repay")) return { label: "Погашение", color: "#fb7185" };
  if (kind === "interest_payout") return { label: "Проценты", color: "#34d399" };
  if (kind === "premium_purchase") return { label: "Премиум", color: "#f472b6" };
  return { label: kind, color: "#94a3b8" };
}

export function getProfileValidTabs(isHost: boolean): ProfileTab[] {
  return isHost ? ["stats", "history", "account", "vds"] : ["history", "account"];
}

export function resolveProfileDefaultTab(search: string, isHost: boolean): ProfileTab {
  const tabParam = new URLSearchParams(search).get("tab");
  const validTabs = getProfileValidTabs(isHost);
  return tabParam && validTabs.includes(tabParam as ProfileTab)
    ? (tabParam as ProfileTab)
    : "history";
}

export function vdsStatusMeta(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    online: { label: "Онлайн", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    offline: { label: "Офлайн", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
    pending: { label: "Ожидание", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
    provisioning: { label: "Настройка…", color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
    error: { label: "Ошибка", color: "#f43f5e", bg: "rgba(244,63,94,0.1)" },
  };
  return map[status] ?? { label: status, color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
}

export function computeAvgSessionMinutes(
  totalMinutesStreamed: number,
  totalSessions: number,
): number {
  return totalSessions > 0 ? Math.round(totalMinutesStreamed / totalSessions) : 0;
}

export function computeHostEarningsLzt(lifetimeEarnings: number, earnings7d: number): {
  lifetimeLzt: number;
  earnings7dLzt: number;
} {
  return {
    lifetimeLzt: Math.round(lifetimeEarnings * LZT_PER_USDT),
    earnings7dLzt: Math.round(earnings7d * LZT_PER_USDT),
  };
}

export type TxWithBalance<T> = T & {
  balanceBefore: number;
  balanceAfter: number;
};

export function enrichTransactionsWithBalances<T extends { amountLzt?: number | null }>(
  txs: T[],
  currentBalance: number,
): TxWithBalance<T>[] {
  return txs.map((tx, idx) => {
    const laterSum = txs.slice(0, idx).reduce((acc, t) => acc + (t.amountLzt ?? 0), 0);
    const balanceAfter = currentBalance - laterSum;
    const balanceBefore = balanceAfter - (tx.amountLzt ?? 0);
    return { ...tx, balanceBefore, balanceAfter };
  });
}

export function isAgentFresh(
  lastSeenAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return lastSeenAt != null && nowMs - new Date(lastSeenAt).getTime() < AGENT_ONLINE_THRESHOLD_MS;
}

export function resolveAgentPresence(
  hostToken: string | null,
  lastSeenAt: string | null | undefined,
  nowMs: number = Date.now(),
): AgentPresence {
  if (!hostToken) return "no_host";
  if (isAgentFresh(lastSeenAt, nowMs)) return "online";
  if (lastSeenAt) return "offline";
  return "unbound";
}

export function computeCreditAvailable(creditLimitLzt: number, creditDebtLzt: number): number {
  return Math.max(0, creditLimitLzt - creditDebtLzt);
}

export function isCreditEnabled(creditLimitLzt: number): boolean {
  return creditLimitLzt > 0;
}
