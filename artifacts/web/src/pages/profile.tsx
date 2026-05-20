import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetHost,
  useGetHostStats,
  useListWalletTransactions,
  useGetWallet,
  getGetHostQueryKey,
  getGetHostStatsQueryKey,
  getListWalletTransactionsQueryKey,
  getGetWalletQueryKey,
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
} from "lucide-react";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

const LZT_PER_USDT = 200;

const formatLzt = (lzt: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.trunc(lzt));

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindLabel(kind: string): { label: string; color: string } {
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

const PAGE_SIZE = 20;

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

  const avgMin =
    stats.totalSessions > 0
      ? Math.round(stats.totalMinutesStreamed / stats.totalSessions)
      : 0;

  const lifetimeLzt = Math.round(stats.lifetimeEarnings * LZT_PER_USDT);
  const earnings7dLzt = Math.round(stats.earnings7d * LZT_PER_USDT);

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

function HistoryTab({ hostToken }: { hostToken: string | null }) {
  const [page, setPage] = useState(0);

  const { data: txs, isLoading: txLoading } = useListWalletTransactions(
    hostToken ?? "",
    {
      query: {
        enabled: !!hostToken,
        queryKey: getListWalletTransactionsQueryKey(hostToken ?? ""),
        staleTime: 30_000,
      },
    },
  );

  const { data: wallet } = useGetWallet(hostToken ?? "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetWalletQueryKey(hostToken ?? ""),
      staleTime: 30_000,
    },
  });

  if (!hostToken) {
    return (
      <div className="mt-10 flex flex-col items-center gap-2 text-slate-500">
        <History className="w-8 h-8 opacity-40" />
        <p className="text-sm">История транзакций пуста.</p>
        <p className="text-xs text-slate-600">
          Зарегистрируйтесь как хост, чтобы начать пополнять историю.
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

  // Compute running balance before/after each transaction.
  // Transactions arrive sorted newest-first. We work backwards using the
  // current total balance (internal + withdrawable) as the anchor.
  const currentBalance =
    (wallet?.internalBalanceLzt ?? 0) +
    (wallet?.withdrawableBalanceLzt ?? 0);

  const enriched = txs.map((tx, idx) => {
    // Sum of all deltas more recent than this row (indices 0..idx-1)
    const laterSum = txs
      .slice(0, idx)
      .reduce((acc, t) => acc + (t.amountLzt ?? 0), 0);
    const balanceAfter = currentBalance - laterSum;
    const balanceBefore = balanceAfter - (tx.amountLzt ?? 0);
    return { ...tx, balanceBefore, balanceAfter };
  });

  const totalPages = Math.ceil(enriched.length / PAGE_SIZE);
  const slice = enriched.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

      {/* Agent / PC specs card */}
      <Card style={cardStyle}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" /> Агент и PC-спецификации
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Unbound state — agent binding is handled by a separate task */}
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
  const isHost = !!hostToken;

  const defaultTab = "history";

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
          </TabsList>

          {isHost && (
            <TabsContent value="stats">
              <StatsTab hostToken={hostToken} />
            </TabsContent>
          )}

          <TabsContent value="history">
            <HistoryTab hostToken={hostToken} />
          </TabsContent>

          <TabsContent value="account">
            <AccountTab hostToken={hostToken} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
