import { useAuth } from "@/hooks/use-auth";
import {
  useGetHostStats,
  useGetHostActivity,
  useListHostSessions,
  useEndSession,
  getGetHostStatsQueryKey,
  getGetHostActivityQueryKey,
  getListHostSessionsQueryKey,
} from "@workspace/api-client-react";
import BindingForm from "./binding-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Copy,
  MonitorPlay,
  PowerOff,
  Clock,
  DollarSign,
  Download,
  HardDrive,
  Gamepad2,
  Wallet,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

export default function Dashboard() {
  const { hostToken } = useAuth();

  const { data: stats, isLoading: statsLoading } = useGetHostStats(
    hostToken || "",
    {
      query: {
        enabled: !!hostToken,
        queryKey: getGetHostStatsQueryKey(hostToken || ""),
      },
    },
  );
  const { data: activity, isLoading: activityLoading } = useGetHostActivity(
    hostToken || "",
    {
      query: {
        enabled: !!hostToken,
        queryKey: getGetHostActivityQueryKey(hostToken || ""),
      },
    },
  );
  const {
    data: sessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useListHostSessions(hostToken || "", {
    query: {
      enabled: !!hostToken,
      queryKey: getListHostSessionsQueryKey(hostToken || ""),
    },
  });

  const endSession = useEndSession();

  const handleCopyLink = (playerToken: string) => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}play/${playerToken}`;
    navigator.clipboard.writeText(link);
    toast.success("Ссылка скопирована");
  };

  const handleEndSession = (id: string) => {
    if (!hostToken) return;
    endSession.mutate(
      { id, data: { hostToken } },
      {
        onSuccess: () => {
          toast.success("Сессия завершена");
          refetchSessions();
        },
        onError: () => {
          toast.error("Не удалось завершить сессию");
        },
      },
    );
  };

  return (
    <div className="space-y-6 text-slate-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Дашборд хоста
          </h1>
          <p className="text-sm text-slate-500">
            Управляй своим узлом и активными сессиями.
          </p>
        </div>
        <a
          href="/api/downloads/host-agent.zip"
          download="cloud-gaming-host-agent.zip"
          data-testid="link-download-host-agent"
        >
          <Button
            variant="outline"
            className="gap-2 h-9 rounded-md border-white/10 text-slate-300 hover:text-white"
          >
            <Download className="h-4 w-4" />
            Скачать агент хоста
          </Button>
        </a>
      </div>

      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Download className="h-4 w-4 text-sky-400" />
            Получить агент
          </CardTitle>
          <CardDescription className="text-slate-500">
            Агент запускается на Windows-ПК и стримит окно игры по WebRTC.
            Скачай ZIP, распакуй и запусти{" "}
            <span className="font-mono text-xs text-sky-400">start.bat</span>.
            Нужен Node.js 20+ (см.{" "}
            <span className="font-mono text-xs text-sky-400">INSTALL.txt</span>{" "}
            внутри архива).
          </CardDescription>
        </CardHeader>
      </Card>

      {hostToken && <BindingForm hostToken={hostToken} />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Активные сессии",
            value: stats?.activeSessions ?? 0,
            hint: "сейчас стримятся",
            icon: <MonitorPlay className="h-4 w-4 text-sky-400" />,
          },
          {
            label: "Всего минут",
            value: `${stats?.totalMinutesStreamed ?? 0}м`,
            hint: "за всё время",
            icon: <Clock className="h-4 w-4 text-sky-400" />,
          },
          {
            label: "Заработано (7 дн.)",
            value: `$${(stats?.earnings7d ?? 0).toFixed(2)}`,
            hint: "за последние 7 дней",
            icon: <Activity className="h-4 w-4 text-sky-400" />,
          },
        ].map((s) => (
          <Card key={s.label} style={cardStyle}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">
                {s.label}
              </CardTitle>
              {s.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : s.value}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
        <Card
          style={{
            background: "rgba(14,165,233,0.08)",
            border: "1px solid rgba(14,165,233,0.35)",
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-sky-300">
              Внутренний (синий)
            </CardTitle>
            <Wallet className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-300">
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                `${(stats?.internalBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT`
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ≈ ${((stats?.internalBalanceLzt ?? 0) / 200).toFixed(2)} · нельзя вывести
            </p>
          </CardContent>
        </Card>
        <Card
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.35)",
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-emerald-300">
              Выводимый (зелёный)
            </CardTitle>
            <Banknote className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-300">
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                `${(stats?.withdrawableBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT`
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ≈ ${((stats?.withdrawableBalanceLzt ?? 0) / 200).toFixed(2)} · можно вывести
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-4" style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <HardDrive className="h-5 w-5 text-sky-400" />
              Сессии узла
            </CardTitle>
            <CardDescription className="text-slate-500">
              Текущие и недавние игровые сессии.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : sessions?.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-8 text-center rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.08)",
                }}
              >
                <Gamepad2 className="h-10 w-10 text-slate-700 mb-4" />
                <p className="text-slate-400 font-medium mb-2">
                  Сессий пока нет
                </p>
                <p className="text-sm text-slate-500 mb-4 max-w-sm">
                  Создай сессию, чтобы получить ссылку для игрока и начать
                  стриминг.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions?.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg gap-4"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          {session.appName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            background:
                              session.status === "active"
                                ? "rgba(20,184,166,0.15)"
                                : "rgba(255,255,255,0.04)",
                            color:
                              session.status === "active" ? "#2dd4bf" : "#94a3b8",
                            border:
                              session.status === "active"
                                ? "1px solid rgba(20,184,166,0.3)"
                                : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {session.status === "active"
                            ? "АКТИВНА"
                            : session.status === "pending"
                              ? "ОЖИДАНИЕ"
                              : "ЗАВЕРШЕНА"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span>{session.resolution}</span>
                        <span>•</span>
                        <span>{session.bitrateKbps} kbps</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(session.createdAt))} назад
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {session.status !== "ended" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none h-8 text-xs border-white/10 text-slate-300 hover:text-white"
                            onClick={() => handleCopyLink(session.playerToken)}
                          >
                            <Copy className="h-3 w-3 mr-1.5" />
                            Ссылка
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none h-8 text-xs"
                            style={{
                              background: "rgba(239,68,68,0.15)",
                              color: "#f87171",
                              border: "1px solid rgba(239,68,68,0.3)",
                            }}
                            onClick={() => handleEndSession(session.id)}
                            disabled={endSession.isPending}
                          >
                            <PowerOff className="h-3 w-3 mr-1.5" />
                            Завершить
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3" style={cardStyle}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Activity className="h-5 w-5 text-sky-400" />
              Лента событий
            </CardTitle>
            <CardDescription className="text-slate-500">
              Недавние события на твоём узле.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activity?.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Событий пока нет.
              </div>
            ) : (
              <div className="space-y-3">
                {activity?.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        {item.kind.includes("session") ? (
                          <MonitorPlay className="h-3.5 w-3.5 text-sky-400" />
                        ) : (
                          <DollarSign className="h-3.5 w-3.5 text-teal-400" />
                        )}
                        {item.title}
                      </div>
                      <time className="text-[10px] font-mono text-slate-500">
                        {formatDistanceToNow(new Date(item.timestamp))} назад
                      </time>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between items-center">
                      <span>{item.subtitle}</span>
                      {item.amount && item.currency && (
                        <span className="font-mono text-teal-400 font-bold">
                          {item.amount > 0 ? "+" : ""}
                          {item.amount} {item.currency}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
