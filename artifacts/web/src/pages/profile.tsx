import { useState } from "react";
import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import { Switch } from "@/components/ui/switch";
import {
  useGetHost,
  useGetHostStats,
  useListWalletTransactions,
  useGetWallet,
  useListMyVds,
  useUpdatePlayerCreditSettings,
  getGetHostQueryKey,
  getGetHostStatsQueryKey,
  getListWalletTransactionsQueryKey,
  getGetWalletQueryKey,
  getListMyVdsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  Clock,
  Cpu,
  History,
  MonitorSmartphone,
  TrendingUp,
  UserCircle2,
  Zap,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Server,
  Wifi,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  PROFILE_HISTORY_PAGE_SIZE,
  computeAvgSessionMinutes,
  computeCreditAvailable,
  computeHostEarningsLzt,
  enrichTransactionsWithBalances,
  formatLzt,
  formatMinutes,
  formatTs,
  isAgentFresh,
  isCreditEnabled,
  kindLabel,
  resolveAgentPresence,
  resolveProfileDefaultTab,
  vdsStatusMeta,
} from "./profile-helpers";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card style={cardStyle}>
      <CardContent className="p-5 flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(14,165,233,0.12)" }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 mb-0.5">{label}</p>
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsTab({ hostToken }: { hostToken: string }) {
  const { data: stats, isLoading, isError } = useGetHostStats(hostToken, {
    query: {
      enabled: true,
      queryKey: getGetHostStatsQueryKey(hostToken),
      staleTime: 30_000,
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} style={cardStyle}>
            <CardContent className="p-5">
              <Skeleton
                className="h-10 w-10 rounded-lg mb-3"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
              <Skeleton
                className="h-3 w-20 mb-2"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
              <Skeleton
                className="h-7 w-28"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="mt-6 text-center text-slate-500 text-sm">
        Не удалось загрузить статистику.
      </div>
    );
  }

  const avgMin = computeAvgSessionMinutes(
    stats.totalMinutesStreamed,
    stats.totalSessions,
  );

  const { lifetimeLzt, earnings7dLzt } = computeHostEarningsLzt(
    stats.lifetimeEarnings,
    stats.earnings7d,
  );

  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Zap className="w-5 h-5 text-sky-400" />}
        label="Доход за всё время"
        value={`${formatLzt(lifetimeLzt)} LZT`}
        sub={`+${formatLzt(earnings7dLzt)} за 7 дн`}
      />
      <StatCard
        icon={<BarChart2 className="w-5 h-5 text-sky-400" />}
        label="Всего сессий"
        value={stats.totalSessions}
        sub={
          stats.activeSessions > 0
            ? `${stats.activeSessions} активных`
            : undefined
        }
      />
      <StatCard
        icon={<Clock className="w-5 h-5 text-sky-400" />}
        label="Суммарное время хостинга"
        value={formatMinutes(stats.totalMinutesStreamed)}
      />
      <StatCard
        icon={<TrendingUp className="w-5 h-5 text-sky-400" />}
        label="Среднее время сессии"
        value={formatMinutes(avgMin)}
      />
    </div>
  );
}

function HistoryTab({ walletToken }: { walletToken: string | null }) {
  const [page, setPage] = useState(0);

  const { data: txs, isLoading: txLoading } = useListWalletTransactions(
    walletToken ?? "",
    {
      query: {
        enabled: !!walletToken,
        queryKey: getListWalletTransactionsQueryKey(walletToken ?? ""),
        staleTime: 30_000,
      },
    },
  );

  const { data: wallet } = useGetWallet(walletToken ?? "", {
    query: {
      enabled: !!walletToken,
      queryKey: getGetWalletQueryKey(walletToken ?? ""),
      staleTime: 30_000,
    },
  });

  if (!walletToken) {
    return (
      <div className="mt-10 flex flex-col items-center gap-2 text-slate-500">
        <History className="w-8 h-8 opacity-40" />
        <p className="text-sm">История транзакций пуста.</p>
        <p className="text-xs text-slate-600">
          Зайдите в каталог игр или на главную — кошелёк создастся автоматически.
        </p>
      </div>
    );
  }

  if (txLoading) {
    return (
      <div className="mt-4 space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
        ))}
      </div>
    );
  }

  if (!txs || txs.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-2 text-slate-500">
        <History className="w-8 h-8 opacity-40" />
        <p className="text-sm">История транзакций пуста.</p>
      </div>
    );
  }

  const currentBalance =
    (wallet?.internalBalanceLzt ?? 0) +
    (wallet?.withdrawableBalanceLzt ?? 0);

  const enriched = enrichTransactionsWithBalances(txs, currentBalance);

  const totalPages = Math.ceil(enriched.length / PROFILE_HISTORY_PAGE_SIZE);
  const slice = enriched.slice(
    page * PROFILE_HISTORY_PAGE_SIZE,
    (page + 1) * PROFILE_HISTORY_PAGE_SIZE,
  );

  return (
    <div className="mt-4">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 w-36">
                  Дата
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">
                  Тип / Описание
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  Сумма
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  До
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500">
                  После
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map((tx, idx) => {
                const { label, color } = kindLabel(tx.kind);
                const isPositive = (tx.amountLzt ?? 0) > 0;
                return (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom:
                        idx < slice.length - 1
                          ? "1px solid rgba(255,255,255,0.04)"
                          : undefined,
                      background:
                        idx % 2 === 0 ? "#0a1018" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatTs(
                        typeof tx.timestamp === "string"
                          ? tx.timestamp
                          : new Date(tx.timestamp).toISOString(),
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant="outline"
                          className="w-fit text-[10px] px-1.5 py-0 font-medium border-0"
                          style={{ background: `${color}18`, color }}
                        >
                          {label}
                        </Badge>
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">
                          {tx.description}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right font-mono font-semibold text-sm whitespace-nowrap"
                      style={{ color: isPositive ? "#22c55e" : "#f87171" }}
                    >
                      {isPositive ? "+" : ""}
                      {formatLzt(tx.amountLzt ?? 0)} LZT
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                      {formatLzt(tx.balanceBefore)} LZT
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                      {formatLzt(tx.balanceAfter)} LZT
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">
            Страница {page + 1} из {totalPages} · {enriched.length} записей
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              style={{
                background: "transparent",
                borderColor: "rgba(255,255,255,0.08)",
                color: "#94a3b8",
              }}
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              style={{
                background: "transparent",
                borderColor: "rgba(255,255,255,0.08)",
                color: "#94a3b8",
              }}
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VdsStatusBadge({ status }: { status: string }) {
  const s = vdsStatusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {status === "online" && <Wifi className="w-3 h-3" />}
      {status === "offline" && <WifiOff className="w-3 h-3" />}
      {status === "error" && <AlertCircle className="w-3 h-3" />}
      {(status === "pending" || status === "provisioning") && (
        <RefreshCw className="w-3 h-3 animate-spin" />
      )}
      {s.label}
    </span>
  );
}

function MyVdsTab({ hostToken }: { hostToken: string | null }) {
  const {
    data: entries,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useListMyVds(
    { ownerToken: hostToken ?? "" },
    {
      query: {
        enabled: !!hostToken,
        queryKey: getListMyVdsQueryKey({ ownerToken: hostToken ?? "" }),
        staleTime: 30_000,
      },
    },
  );

  if (!hostToken) {
    return (
      <div className="mt-10 flex flex-col items-center gap-2 text-slate-500">
        <Server className="w-8 h-8 opacity-40" />
        <p className="text-sm">Войдите как хост, чтобы управлять VDS.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 space-y-3">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-6 text-center text-red-400 text-sm">
        Не удалось загрузить VDS.
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-slate-500">
        <Server className="w-10 h-10 opacity-30" />
        <p className="text-sm">У тебя нет подключённых VDS-серверов.</p>
        <p className="text-xs text-slate-600">
          При создании квоты открой секцию «Хостинг через VDS» и добавь свой сервер.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "#94a3b8", background: "transparent" }}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Обновить
        </Button>
      </div>
      {entries.map((vds) => (
        <Card key={vds.id} style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(14,165,233,0.1)" }}
                >
                  <Server className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {vds.sshUser}@{vds.sshHost}:{vds.sshPort}
                  </p>
                  {vds.quotaTitle && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Квота: {vds.quotaTitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <VdsStatusBadge status={vds.status} />
                <Badge
                  variant="outline"
                  className="border-0 text-xs"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}
                >
                  VDS
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div
                className="rounded-lg p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-xs text-slate-500 mb-1">Заработано</p>
                <p className="text-sm font-bold text-emerald-300">
                  {new Intl.NumberFormat("ru-RU").format(vds.earnedLzt)} LZT
                </p>
              </div>
              <div
                className="rounded-lg p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-xs text-slate-500 mb-1">Последний пинг</p>
                <p className="text-sm text-slate-300">
                  {vds.lastHealthAt
                    ? new Date(vds.lastHealthAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
              <div
                className="rounded-lg p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <p className="text-xs text-slate-500 mb-1">Добавлен</p>
                <p className="text-sm text-slate-300">
                  {new Date(vds.createdAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {vds.provisionLog && (
              <details className="mt-3">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                  Лог провижининга
                </summary>
                <pre
                  className="mt-2 text-xs text-slate-400 rounded-md p-3 overflow-auto max-h-40"
                  style={{ background: "rgba(0,0,0,0.3)", fontFamily: "monospace" }}
                >
                  {vds.provisionLog}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlayerCreditCard() {
  const { playerWalletToken } = usePlayerWallet();
  const { data: wallet, refetch } = useGetWallet(playerWalletToken ?? "", {
    query: {
      enabled: !!playerWalletToken,
      queryKey: getGetWalletQueryKey(playerWalletToken ?? ""),
    },
  });
  const { mutateAsync: updateCreditSettings, isPending: saving } =
    useUpdatePlayerCreditSettings();

  if (!playerWalletToken) return null;

  const creditLimit = wallet?.creditLimitLzt ?? 0;
  const creditDebt = wallet?.creditDebtLzt ?? 0;
  const creditEnabled = isCreditEnabled(creditLimit);

  const toggleCredit = async (enabled: boolean) => {
    await updateCreditSettings({ data: { creditEnabled: enabled } });
    await refetch();
  };

  return (
    <Card style={cardStyle}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-200">
          Игра в кредит
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">Разрешить играть в кредит</p>
            <p className="text-xs text-slate-500">По умолчанию включено для новичков</p>
          </div>
          <Switch
            checked={creditEnabled}
            disabled={saving}
            onCheckedChange={(v) => void toggleCredit(v)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-slate-500">Лимит</p>
            <p className="text-white font-semibold">{formatLzt(creditLimit)} LZT</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-slate-500">Долг</p>
            <p className="text-amber-400 font-semibold">{formatLzt(creditDebt)} LZT</p>
          </div>
          <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-slate-500">Доступно</p>
            <p className="text-emerald-400 font-semibold">
              {formatLzt(computeCreditAvailable(creditLimit, creditDebt))} LZT
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountTab({ hostToken }: { hostToken: string | null }) {
  const { data: host, isLoading } = useGetHost(hostToken ?? "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetHostQueryKey(hostToken ?? ""),
      staleTime: 60_000,
    },
  });

  return (
    <div className="mt-4 space-y-4">
      <Card style={cardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-200">
            Основная информация
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(14,165,233,0.12)" }}
            >
              <UserCircle2 className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Отображаемое имя</p>
              {isLoading ? (
                <Skeleton
                  className="h-5 w-32"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              ) : (
                <p className="text-white font-semibold">
                  {host?.displayName ?? (hostToken ? "Загрузка…" : "Гость")}
                </p>
              )}
            </div>
          </div>

          {hostToken && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div
                className="rounded-lg p-3"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="text-xs text-slate-500 mb-1">Роль</p>
                <Badge
                  variant="outline"
                  className="border-0 text-xs font-medium"
                  style={{
                    background: "rgba(14,165,233,0.1)",
                    color: "#38bdf8",
                  }}
                >
                  Хост
                </Badge>
              </div>
              <div
                className="rounded-lg p-3"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="text-xs text-slate-500 mb-1">Аккаунт создан</p>
                {isLoading ? (
                  <Skeleton
                    className="h-4 w-24"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  />
                ) : (
                  <p className="text-sm text-slate-300">
                    {host?.createdAt
                      ? new Date(host.createdAt).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PlayerCreditCard />

      {/* Agent / PC specs card */}
      <Card style={cardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" /> Агент и PC-спецификации
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const lastSeenAt = host?.lastSeenAt ?? null;
            const pcSpecs = (host as { pcSpecs?: { cpu?: string; gpu?: string; ramGb?: number } | null } | undefined)?.pcSpecs;
            const presence = resolveAgentPresence(hostToken, lastSeenAt);
            const fresh = isAgentFresh(lastSeenAt);

            if (presence === "no_host") {
              return (
                <div className="flex items-center gap-3 py-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(148,163,184,0.1)" }}
                  >
                    <WifiOff className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Нет аккаунта хоста</p>
                    <p className="text-xs text-slate-500">
                      Зарегистрируйтесь как хост, чтобы привязать агент и видеть спецификации ПК.
                    </p>
                  </div>
                </div>
              );
            }

            if (isLoading) {
              return (
                <Skeleton
                  className="h-14 w-full"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                />
              );
            }

            if (fresh) {
              return (
                <div className="space-y-3 py-1">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(16,185,129,0.12)" }}
                    >
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-300">Агент онлайн</p>
                      <p className="text-xs text-slate-500">
                        Последний heartbeat{" "}
                        {new Date(lastSeenAt!).toLocaleString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  {pcSpecs && (pcSpecs.cpu || pcSpecs.gpu || pcSpecs.ramGb) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400">
                      {pcSpecs.cpu && <div>CPU: <span className="text-slate-300">{pcSpecs.cpu}</span></div>}
                      {pcSpecs.gpu && <div>GPU: <span className="text-slate-300">{pcSpecs.gpu}</span></div>}
                      {pcSpecs.ramGb != null && (
                        <div>RAM: <span className="text-slate-300">{pcSpecs.ramGb} ГБ</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            if (presence === "offline") {
              return (
                <div className="flex items-center gap-3 py-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(245,158,11,0.1)" }}
                  >
                    <WifiOff className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Агент офлайн</p>
                    <p className="text-xs text-slate-500">
                      Был на связи {new Date(lastSeenAt!).toLocaleString("ru-RU")}. Запустите десктопный агент.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "rgba(248,113,113,0.1)" }}
                >
                  <WifiOff className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Агент не привязан
                  </p>
                  <p className="text-xs text-slate-500">
                    Привяжите десктопный агент, чтобы здесь отображались спецификации вашего ПК.
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {!hostToken && (
        <Card
          style={{ ...cardStyle, borderColor: "rgba(14,165,233,0.15)" }}
        >
          <CardContent className="p-5 flex items-center gap-4">
            <MonitorSmartphone className="w-8 h-8 text-sky-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">
                Зарегистрируйтесь как хост
              </p>
              <p className="text-xs text-slate-500">
                Перейдите в раздел «Хостить», чтобы создать аккаунт хоста и начать зарабатывать.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { hostToken } = useAuth();
  const { playerWalletToken } = usePlayerWallet();
  const walletToken = playerWalletToken ?? hostToken ?? null;
  const isHost = !!hostToken;
  const search = useSearch();
  const defaultTab = resolveProfileDefaultTab(search, isHost);

  return (
    <div
      className="min-h-screen flex flex-col text-slate-300"
      style={{ background: "#06090e" }}
    >
      <SiteNav activePath="/profile" />
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)" }}
          >
            <UserCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">
              Профиль
            </h1>
            <p className="text-xs text-slate-500">
              {isHost
                ? "Статистика, история и настройки аккаунта"
                : "История и настройки аккаунта"}
            </p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList
            className="mb-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {isHost && (
              <TabsTrigger
                value="stats"
                className="text-xs"
                data-testid="tab-stats"
              >
                <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
                Статистика
              </TabsTrigger>
            )}
            <TabsTrigger
              value="history"
              className="text-xs"
              data-testid="tab-history"
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              История
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="text-xs"
              data-testid="tab-account"
            >
              <UserCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Аккаунт
            </TabsTrigger>
            {isHost && (
              <TabsTrigger
                value="vds"
                className="text-xs"
                data-testid="tab-vds"
              >
                <Server className="w-3.5 h-3.5 mr-1.5" />
                Мои VDS
              </TabsTrigger>
            )}
          </TabsList>

          {isHost && (
            <TabsContent value="stats">
              <StatsTab hostToken={hostToken} />
            </TabsContent>
          )}

          <TabsContent value="history">
            <HistoryTab walletToken={walletToken} />
          </TabsContent>

          <TabsContent value="account">
            <AccountTab hostToken={hostToken} />
          </TabsContent>

          {isHost && (
            <TabsContent value="vds">
              <MyVdsTab hostToken={hostToken} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
