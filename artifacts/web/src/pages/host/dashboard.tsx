import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  useGetHost,
  useGetHostStats,
  useGetHostActivity,
  useGetHostAgentEvents,
  getGetHostAgentEventsQueryKey,
  useListHostSessions,
  useEndSession,
  useGetHostCurrentQuota,
  useListHostLibrary,
  useRemoveHostLibraryEntry,
  useDetachQuotaFromSession,
  getGetHostQueryKey,
  getGetHostStatsQueryKey,
  getGetHostActivityQueryKey,
  getListHostSessionsQueryKey,
  getGetHostCurrentQuotaQueryKey,
  getListHostLibraryQueryKey,
  issueAgentBindCode,
  createTestSession,
  getHostReadiness,
  type HostLibraryEntry,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Wifi,
  WifiOff,
  ExternalLink,
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Monitor,
  Loader2,
  Cpu,
  MemoryStick,
  Tag,
  Unlink,
  Volume2,
  VolumeX,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "wouter";
import { discoverAgentPort, probeAgentReadiness } from "@/lib/agent-local";
import { localizeAgentEventMessage } from "@/lib/agent-event-labels";
import { formatApiError } from "@/lib/api-errors";
import {
  type AgentState,
  type HeartbeatState,
  type AudioMode,
  AUDIO_MODE_LABELS,
  getAgentDiagnosis,
  resolveHeartbeatState,
  agentNeedsAdvancedPanel,
  getAgentEventLevelStyle,
  buildPlayerPlayLink,
  resolveTestSessionOpenTarget,
  buildTestSessionFullUrl,
  buildBrowserHostStorageKeys,
  computeQuickStartSteps,
  resolveGuidedNextAction,
  hasCompletedFirstStream,
  downloadHostAgentBundle,
  markHostAgentDownloaded,
  readHostAgentDownloaded,
  readHostGoOnlineAck,
  markHostGoOnlineAck,
  HOST_AGENT_EXE_DOWNLOAD_URL,
  evaluateHostReadiness,
  type HostReadinessResult,
} from "./dashboard-helpers";
import { QuickAddFirstGame } from "./add-game-modal";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

// ── Agent ping check ──────────────────────────────────────────────────────

async function pingAgent(): Promise<AgentState> {
  const info = await discoverAgentPort({ force: true, timeoutMs: 900 });
  if (!info) return { status: "offline" };
  return {
    status: "online",
    version: info.version,
    audioMode: (info.audioMode ?? "off") as AudioMode,
    port: info.port,
  };
}

function AgentSymptomTable({
  agent,
  heartbeat,
}: {
  agent: AgentState;
  heartbeat: HeartbeatState;
}) {
  const rows = getAgentDiagnosis(agent, heartbeat);
  if (rows.length === 0) return null;

  return (
    <div
      className="mt-3 overflow-x-auto rounded-lg border border-white/5"
      data-testid="agent-symptom-table"
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5 text-slate-500">
            <th className="px-3 py-2 text-left font-medium">Симптом</th>
            <th className="px-3 py-2 text-left font-medium">Вероятная причина</th>
            <th className="px-3 py-2 text-left font-medium">Что сделать</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symptom} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-2 text-slate-300 align-top">{row.symptom}</td>
              <td className="px-3 py-2 text-slate-400 align-top">{row.likelyCause}</td>
              <td className="px-3 py-2 text-sky-300 align-top">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentTroubleshootChecklist({
  agent,
  heartbeat,
}: {
  agent?: AgentState;
  heartbeat?: HeartbeatState;
}) {
  const showPortHint =
    !agent ||
    agent.status === "offline" ||
    heartbeat?.status === "stale" ||
    heartbeat?.status === "never";
  const showAdminHint =
    !agent || agent.status !== "online" || heartbeat?.status !== "fresh";
  const defaultOpen =
    agent?.status === "offline" || heartbeat?.status === "stale";

  return (
    <details
      className="w-full mt-2"
      data-testid="agent-troubleshoot"
      open={defaultOpen}
    >
      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 select-none">
        Если не работает — чеклист
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc pl-5">
        <li>
          Установлен <span className="text-slate-300">Node.js 20+</span> — проверь командой{" "}
          <span className="font-mono text-sky-400">node --version</span>
        </li>
        <li>
          Агент запущен через <span className="font-mono text-sky-400">start.bat</span> и не закрыт
          (иконка в трее)
        </li>
        {showAdminHint && (
          <li>
            Для игр с античитом запускай <span className="font-mono text-sky-400">start.bat</span>{" "}
            <span className="text-slate-300">от имени администратора</span>
          </li>
        )}
        {showPortHint && (
          <li>
            Файрвол/антивирус не блокирует порты{" "}
            <span className="font-mono text-sky-400">18080–18083</span> и исходящие соединения агента
          </li>
        )}
        <li>
          В агенте должна быть надпись «Вход выполнен» (токен из ZIP подставляется сам)
        </li>
        {heartbeat?.status === "stale" && (
          <li>
            Если агент завис — закрой через трей и перезапусти{" "}
            <span className="font-mono text-sky-400">start.bat</span>
          </li>
        )}
      </ul>
    </details>
  );
}

// ── Agent telemetry events ────────────────────────────────────────────────
// The agent pushes startup/error events to the server; this card makes them
// visible on the dashboard so a silently-dying agent still leaves a trace.

function AgentEventsCard({ hostToken }: { hostToken: string }) {
  const { data: events, isLoading, refetch, isRefetching } = useGetHostAgentEvents(
    hostToken,
    {
      query: {
        enabled: !!hostToken,
        queryKey: getGetHostAgentEventsQueryKey(hostToken),
        refetchInterval: 30_000,
      },
    },
  );

  const hasErrors = (events ?? []).some(
    (e) => e.level === "error" || e.level === "fatal",
  );

  return (
    <Card
      style={
        hasErrors
          ? { background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)" }
          : cardStyle
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-sky-400" />
            События агента
            {hasErrors && (
              <Badge className="bg-red-500/15 text-red-300 border border-red-500/30 text-[10px]">
                есть ошибки
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="button-refresh-agent-events"
          >
            <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
        <CardDescription className="text-xs text-slate-500">
          Агент сам отправляет сюда свои ошибки — даже если окно закрылось без сообщений.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !events || events.length === 0 ? (
          <p className="text-xs text-slate-500 py-2" data-testid="text-no-agent-events">
            Пока нет событий. Запусти start.bat на своём ПК — здесь появится статус запуска
            (или причина падения).
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1" data-testid="list-agent-events">
            {events.map((e) => {
              const style = getAgentEventLevelStyle(e.level);
              return (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold ${style.badge}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">
                    {localizeAgentEventMessage(e.message)}
                    {e.agentVersion && (
                      <span className="text-slate-600 ml-1">v{e.agentVersion}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-slate-600 font-mono text-[10px] mt-0.5">
                    {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true, locale: ru })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgentStatusCard({ agent, heartbeat }: { agent: AgentState; heartbeat: HeartbeatState }) {
  const handleDownloadAgent = () => {
    void downloadHostAgentBundle().catch(() => {
      toast.error("Не удалось скачать агент");
    });
  };

  // A fresh server-side heartbeat means the agent is running (possibly on
  // another PC) even if the local ping to localhost:18080 fails.
  if (agent.status === "offline" && heartbeat.status === "fresh") {
    return (
      <Card
        style={{
          background: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
      >
        <CardContent className="py-4 flex flex-wrap items-center gap-3" data-testid="agent-status-heartbeat">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold text-emerald-300">Агент онлайн</span>
            <span className="text-xs text-slate-500">
              (на другом ПК · был на связи{" "}
              {formatDistanceToNow(new Date(heartbeat.lastSeenAt), { addSuffix: true, locale: ru })})
            </span>
          </span>
        </CardContent>
      </Card>
    );
  }

  if (agent.status === "checking") {
    return (
      <Card style={cardStyle}>
        <CardContent className="py-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          <span className="text-sm text-slate-500">Проверяем агент…</span>
        </CardContent>
      </Card>
    );
  }

  if (heartbeat.status === "stale" && agent.status !== "online") {
    return (
      <Card
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
      >
        <CardHeader className="pb-3" data-testid="agent-status-stale">
          <CardTitle className="flex items-center gap-2 text-base text-amber-200 mb-1">
            <WifiOff className="h-4 w-4 text-amber-400" />
            Агент не отвечает
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Последний сигнал{" "}
            {formatDistanceToNow(new Date(heartbeat.lastSeenAt), { addSuffix: true, locale: ru })}
            . Возможно, агент завис или потерял сеть.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AgentSymptomTable agent={agent} heartbeat={heartbeat} />
          <AgentTroubleshootChecklist agent={agent} heartbeat={heartbeat} />
        </CardContent>
      </Card>
    );
  }

  if (agent.status === "online") {
    return (
      <Card
        style={{
          background: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
      >
        <CardContent className="py-4 flex flex-wrap items-center gap-3" data-testid="agent-status-online">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-sm font-semibold text-emerald-300">
              Агент онлайн
            </span>
            <span className="text-xs text-slate-500 font-mono">
              v{agent.version}
            </span>
            <span className="flex items-center gap-1 text-xs font-mono text-slate-400 ml-1">
              {agent.audioMode === "off" ? (
                <VolumeX className="h-3 w-3 text-slate-600" />
              ) : (
                <Volume2 className="h-3 w-3 text-sky-400" />
              )}
              {AUDIO_MODE_LABELS[agent.audioMode]}
            </span>
          </span>
          <div className="flex gap-2 ml-auto">
            <a href="decenthub://open" target="_blank" rel="noreferrer">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs border-emerald-500/30 text-emerald-300 hover:text-white hover:border-emerald-400"
              >
                <ExternalLink className="h-3 w-3" />
                Открыть агент
              </Button>
            </a>
            <a
              href={`http://127.0.0.1:${agent.port}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 h-8 text-xs text-slate-400 hover:text-white"
              >
                <Wifi className="h-3 w-3" />
                localhost:{agent.port}
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={{
        background: "rgba(14,165,233,0.05)",
        border: "1px solid rgba(14,165,233,0.2)",
      }}
    >
      <CardHeader className="pb-3" data-testid="agent-status-offline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-white mb-1">
              <WifiOff className="h-4 w-4 text-sky-400" />
              Агент не запущен
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Скачай архив, распакуй и запусти{" "}
              <span className="font-mono text-sky-400">start.bat</span> на своём Windows-ПК.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Button
              size="sm"
              className="gap-2 h-8 text-xs font-semibold"
              style={{ background: "#0ea5e9", color: "#fff" }}
              data-testid="link-download-host-agent"
              onClick={handleDownloadAgent}
            >
              <Download className="h-3.5 w-3.5" />
              Скачать агент
            </Button>
            <a
              href={HOST_AGENT_EXE_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-500 hover:text-sky-400 underline-offset-2 hover:underline"
              data-testid="link-download-host-agent-exe"
            >
              Или .exe без Node.js (нужен код привязки в «Если не работает»)
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="space-y-1.5 text-xs text-slate-400">
          {[
            {
              n: "1",
              text: "Нажми «Скачать агент» выше и распакуй ZIP (например C:\\CloudAgent) — токен и адрес платформы уже внутри",
            },
            {
              n: "2",
              text: "Дважды кликни start.bat — при первом запуске установит зависимости (~2 мин)",
            },
            {
              n: "3",
              text: "Дождись «Агент онлайн» на этой странице — в агенте будет «Вход выполнен»",
            },
            {
              n: "4",
              text: "Добавь игру в библиотеку (путь к .exe) и в агенте нажми «Выйти в онлайн»",
            },
            {
              n: "5",
              text: "Создай тест-сессию и проверь, что картинка и управление работают",
            },
          ].map((s) => (
            <li key={s.n} className="flex items-start gap-2">
              <span
                className="shrink-0 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8" }}
              >
                {s.n}
              </span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-slate-600">
          Нужен Node.js 20+ · Windows 10/11 · Запусти от имени администратора, если игра не захватывается
        </p>
        <AgentSymptomTable agent={agent} heartbeat={heartbeat} />
        <AgentTroubleshootChecklist agent={agent} heartbeat={heartbeat} />
      </CardContent>
    </Card>
  );
}

// ── Host library templates ────────────────────────────────────────────────

function HostTemplates({ hostToken }: { hostToken: string }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<HostLibraryEntry | null>(null);

  const {
    data: entries,
    isLoading: loading,
    isError,
    refetch,
  } = useListHostLibrary(hostToken, {
    query: {
      enabled: !!hostToken,
      queryKey: getListHostLibraryQueryKey(hostToken),
    },
  });

  const removeMutation = useRemoveHostLibraryEntry();

  const handleDelete = () => {
    if (!deleteEntry) return;
    const entry = deleteEntry;
    setRemoving(entry.gameId);
    removeMutation.mutate(
      { hostToken, gameId: entry.gameId },
      {
        onSuccess: () => {
          toast.success(`«${entry.game.title}» удалена из шаблонов`);
          setDeleteEntry(null);
          void refetch();
        },
        onError: () => {
          toast.error("Не удалось удалить шаблон");
        },
        onSettled: () => {
          setRemoving(null);
        },
      },
    );
  };

  return (
    <>
      <Card style={cardStyle}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Gamepad2 className="h-5 w-5 text-sky-400" />
              Мои шаблоны хостинга
            </CardTitle>
            <CardDescription className="text-slate-500 mt-0.5">
              Настроенные игры и цены — готовы к запуску. В агенте при «Выйти в онлайн»
              появятся быстрые рекомендации из Steam (игры, которые уже стоят у тебя
              и есть в каталоге).
            </CardDescription>
          </div>
          <Link href="/host/library">
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs font-semibold"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Новый шаблон
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-400">Не удалось загрузить шаблоны</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Повторить
              </Button>
            </div>
          ) : !entries || entries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 text-center rounded-lg"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.08)",
              }}
            >
              <Gamepad2 className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-400 font-medium mb-1">Шаблонов пока нет</p>
              <p className="text-sm text-slate-500 mb-4 max-w-xs">
                Добавь игру из каталога, укажи путь к .exe и цену — получишь
                готовый шаблон для запуска.
              </p>
              <Link href="/host/library">
                <Button
                  size="sm"
                  className="gap-1.5"
                  style={{ background: "#0ea5e9", color: "#fff" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Добавить первый шаблон
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isBrowser = !!(entry.game.browserHostUrl);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      {entry.game.coverImageUrl ? (
                        <img
                          src={entry.game.coverImageUrl}
                          alt=""
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Gamepad2 className="h-4 w-4 text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">
                          {entry.game.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 flex-shrink-0"
                          style={{
                            background: isBrowser
                              ? "rgba(16,185,129,0.12)"
                              : "rgba(14,165,233,0.12)",
                            color: isBrowser ? "#34d399" : "#38bdf8",
                            border: isBrowser
                              ? "1px solid rgba(16,185,129,0.3)"
                              : "1px solid rgba(14,165,233,0.3)",
                          }}
                        >
                          {isBrowser ? (
                            <Globe className="h-2.5 w-2.5 mr-0.5" />
                          ) : (
                            <Monitor className="h-2.5 w-2.5 mr-0.5" />
                          )}
                          {isBrowser ? "браузер" : "нативная"}
                        </Badge>
                        {!entry.enabled && (
                          <span className="text-[10px] text-slate-600 italic">
                            выключена
                          </span>
                        )}
                        {entry.hasActiveSession && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1.5"
                            style={{
                              background: "rgba(20,184,166,0.12)",
                              color: "#2dd4bf",
                              border: "1px solid rgba(20,184,166,0.3)",
                            }}
                          >
                            АКТИВНА
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        {entry.pricePerMinuteLzt.toLocaleString("ru-RU")} LZT/мин
                        <span className="ml-1 text-slate-600">
                          ≈${(entry.pricePerMinuteLzt / 200).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link href="/host/library">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          title="Редактировать в библиотеке"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                        disabled={entry.hasActiveSession || removing === entry.gameId}
                        title={
                          entry.hasActiveSession
                            ? "Нельзя удалить: идёт сессия"
                            : "Удалить шаблон"
                        }
                        onClick={() => setDeleteEntry(entry)}
                      >
                        {removing === entry.gameId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!deleteEntry}
        onOpenChange={(v) => {
          if (!v) setDeleteEntry(null);
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Удалить шаблон?</DialogTitle>
            <DialogDescription className="text-slate-500">
              «{deleteEntry?.game.title}» будет убрана из шаблонов хостинга. Это действие
              нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteEntry(null)}
              className="text-slate-400"
            >
              Отмена
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={removing !== null}
              onClick={handleDelete}
            >
              {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Удалить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Current quota card ────────────────────────────────────────────────────

function CurrentQuotaCard({ hostToken }: { hostToken: string }) {
  const [confirmDetach, setConfirmDetach] = useState(false);
  const {
    data: info,
    isError: loadFailed,
    isLoading,
    refetch,
  } = useGetHostCurrentQuota(
    { hostToken },
    {
      query: {
        enabled: !!hostToken,
        queryKey: getGetHostCurrentQuotaQueryKey({ hostToken }),
        refetchInterval: 15_000,
      },
    },
  );

  const detachMutation = useDetachQuotaFromSession();

  const handleDetach = () => {
    detachMutation.mutate(
      { data: { hostToken } },
      {
        onSuccess: () => {
          toast.success("Квота отвязана");
          setConfirmDetach(false);
          void refetch();
        },
        onError: () => {
          toast.error("Не удалось отвязать квоту");
        },
      },
    );
  };

  if (isLoading && !info) {
    return (
      <Card style={cardStyle}>
        <CardContent className="py-4">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (loadFailed && !info) {
    return (
      <Card style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}>
        <CardContent className="py-4 text-sm text-slate-500">
          Не удалось загрузить текущую квоту. Проверьте подключение к API.
        </CardContent>
      </Card>
    );
  }

  if (!info) return null;

  return (
    <>
      <Card
        style={
          info.quota
            ? { background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)" }
            : cardStyle
        }
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <Tag className="h-4 w-4 text-emerald-400" />
            Текущая квота
          </CardTitle>
          <CardDescription className="text-slate-500">
            Квота, прикреплённая к активной сессии.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {info.quota ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-semibold text-emerald-300 text-sm">
                  {info.quota.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  {info.quota.kind === "sponsor"
                    ? `Спонсор · ${(info.quota.escrowRemainingLzt ?? 0).toLocaleString("ru-RU")} LZT осталось`
                    : `Роялти`}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:text-white hover:border-red-400"
                onClick={() => setConfirmDetach(true)}
                disabled={detachMutation.isPending}
              >
                {detachMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                Отвязать и взять другую
              </Button>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Квота не подключена. Включи автоподбор в агенте — он сам найдёт подходящие задачи.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmDetach} onOpenChange={setConfirmDetach}>
        <DialogContent
          className="sm:max-w-sm"
          style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Отвязать квоту?</DialogTitle>
            <DialogDescription className="text-slate-500">
              Сессия продолжит работу без этой квоты. Можно будет подключить другую.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDetach(false)}
              className="text-slate-400"
            >
              Отмена
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={detachMutation.isPending}
              onClick={handleDetach}
            >
              {detachMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Отвязать"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Quick start (5 steps) ─────────────────────────────────────────────────

function HostQuickStartCard({
  hostToken,
  agent,
  heartbeat,
  agentKeyBound,
  libraryCount,
  hasActiveSession,
  hasFirstStream,
  onTestStream,
  testLoading,
}: {
  hostToken: string;
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  libraryCount: number;
  hasActiveSession: boolean;
  hasFirstStream: boolean;
  onTestStream: () => void;
  testLoading: boolean;
}) {
  const [agentDownloaded, setAgentDownloaded] = useState(() => readHostAgentDownloaded());
  const [goOnlineAck, setGoOnlineAck] = useState(() => readHostGoOnlineAck());
  const { steps, allDone } = computeQuickStartSteps({
    agent,
    heartbeat,
    agentKeyBound,
    libraryCount,
    hasActiveSession,
    agentDownloaded,
    goOnlineAck,
  });
  const guided = resolveGuidedNextAction({
    agent,
    heartbeat,
    agentKeyBound,
    libraryCount,
    hasActiveSession,
    agentDownloaded,
    goOnlineAck,
    hasFirstStream,
  });
  const onboarding = !hasFirstStream && guided.phase !== "complete";
  const completedSteps = steps.filter((s) => s.done);

  const handleDownloadAgent = () => {
    markHostAgentDownloaded();
    setAgentDownloaded(true);
    void downloadHostAgentBundle().catch(() => {
      toast.error("Не удалось скачать агент");
    });
  };

  if (!onboarding) {
    return (
      <Card
        style={{
          background: "rgba(16,185,129,0.06)",
          border: "1px solid rgba(16,185,129,0.3)",
        }}
        data-testid="host-quick-start"
      >
        <CardContent className="py-4 flex items-center gap-3">
          <Wifi className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">
              {allDone ? "Готов принимать игроков" : "Онбординг завершён"}
            </p>
            <p className="text-xs text-slate-500">
              Первый стрим прошёл — ниже полный дашборд
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={{
        background: "rgba(14,165,233,0.05)",
        border: "1px solid rgba(14,165,233,0.25)",
      }}
      data-testid="host-quick-start"
      data-guided-phase={guided.phase}
    >
      <CardHeader className="pb-3">
        <CardDescription className="text-sky-400/80 text-xs font-medium">
          Шаг {guided.stepNumber} из {guided.totalSteps}
        </CardDescription>
        <CardTitle className="text-white text-lg flex items-center gap-2 mt-1">
          <Gamepad2 className="h-5 w-5 text-sky-400 shrink-0" />
          {guided.title}
        </CardTitle>
        <CardDescription className="text-slate-400 text-sm mt-1">
          {guided.hint}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {completedSteps.length > 0 && (
          <div
            className="flex flex-wrap gap-2 text-xs text-emerald-400/90"
            data-testid="guided-completed-steps"
          >
            {completedSteps.map((s) => (
              <span key={s.title} className="inline-flex items-center gap-1">
                <span aria-hidden>✓</span>
                {s.title}
              </span>
            ))}
          </div>
        )}

        {guided.cta === "download" && (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2 font-semibold"
              style={{ background: "#0ea5e9", color: "#fff" }}
              data-testid="link-download-host-agent"
              onClick={handleDownloadAgent}
            >
              <Download className="h-4 w-4" />
              Скачать агент
            </Button>
            <p className="text-[11px] text-slate-500">
              Или{" "}
              <a
                href={HOST_AGENT_EXE_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-sky-400 underline-offset-2 hover:underline"
                data-testid="link-download-host-agent-exe"
              >
                .exe без Node.js
              </a>{" "}
              — понадобится код привязки в «Если не работает»
            </p>
          </div>
        )}

        {guided.cta === "wait" && (
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "rgba(0,0,0,0.25)" }}
            data-testid="guided-wait-agent"
          >
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
              Ждём агент на связи…
            </div>
            <p className="text-xs text-slate-400">
              Запусти <span className="font-mono text-sky-400">start.bat</span> на Windows-ПК.
              Окно уйдёт в трей — настройки открой по иконке в трее.
            </p>
            <AgentTroubleshootChecklist agent={agent} heartbeat={heartbeat} />
          </div>
        )}

        {guided.cta === "add-game" && <QuickAddFirstGame hostToken={hostToken} guided />}

        {guided.cta === "open-agent" && (
          <a
            href="decenthub://open"
            data-testid="guided-open-agent"
            onClick={() => {
              markHostGoOnlineAck();
              setGoOnlineAck(true);
            }}
          >
            <Button
              size="lg"
              className="w-full sm:w-auto gap-2 font-semibold"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              <ExternalLink className="h-4 w-4" />
              Открыть агент
            </Button>
          </a>
        )}

        {guided.cta === "test-stream" && (
          <Button
            size="lg"
            className="w-full sm:w-auto gap-2 font-semibold bg-violet-600 hover:bg-violet-500 text-white"
            onClick={onTestStream}
            disabled={testLoading}
            data-testid="button-test-session"
          >
            <FlaskConical className="h-4 w-4" />
            {testLoading ? "Создаём…" : "Проверить стрим"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AgentBindCodeCard({ hostToken, guided = false }: { hostToken: string; guided?: boolean }) {
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const issueCode = async () => {
    setLoading(true);
    try {
      const json = await issueAgentBindCode({
        headers: {
          Authorization: `Bearer ${hostToken}`,
          "X-User-Token": hostToken,
        },
      });
      if (!json.bindCode) {
        toast.error("Не удалось выдать код");
        return;
      }
      setBindCode(json.bindCode);
      setExpiresAt(json.expiresAt ?? null);
      toast.success("Код привязки создан — вставь в агент или запусти с --bind-code=…");
    } catch (err) {
      const msg = (err as { data?: { error?: string } }).data?.error;
      toast.error(msg ?? "Нет соединения");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!bindCode) return;
    void navigator.clipboard.writeText(bindCode).then(
      () => toast.success("Код скопирован"),
      () => toast.error("Не удалось скопировать"),
    );
  };

  const expired =
    expiresAt != null && Date.now() > expiresAt;

  const body = (
    <div className="space-y-3" data-testid={guided ? "guided-bind-agent" : undefined}>
      {bindCode && !expired ? (
        <div className="flex flex-wrap items-center gap-2">
          <code
            className="font-mono text-lg tracking-widest text-sky-300 px-3 py-1.5 rounded"
            style={{
              background: "rgba(14,165,233,0.08)",
              border: "1px solid rgba(14,165,233,0.25)",
            }}
          >
            {bindCode}
          </code>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={copyCode}>
            <Copy className="h-3 w-3" />
            Копировать
          </Button>
          {expiresAt != null && (
            <span className="text-xs text-slate-500">
              действует{" "}
              {formatDistanceToNow(new Date(expiresAt), { addSuffix: true, locale: ru })}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {expired
            ? "Код истёк — создай новый."
            : guided
              ? "Нажми кнопку ниже — код действует короткое время."
              : "Код ещё не создан. Действует короткое время и сгорает после использования."}
        </p>
      )}
      <Button
        size={guided ? "lg" : "sm"}
        className={`gap-1.5 font-semibold ${guided ? "w-full sm:w-auto" : "h-8 text-xs"}`}
        style={{ background: "#0ea5e9", color: "#fff" }}
        onClick={() => void issueCode()}
        disabled={loading}
        data-testid="button-issue-bind-code"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {bindCode && !expired ? "Выдать новый код" : "Получить код привязки"}
      </Button>
    </div>
  );

  if (guided) return body;

  return (
    <Card style={cardStyle}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <KeyRound className="h-4 w-4 text-sky-400" />
          Код привязки агента
        </CardTitle>
        <CardDescription className="text-slate-500">
          Одноразовый код — только если ставили .exe или ZIP без токена. Основной путь: скачай ZIP с дашборда.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">{body}</CardContent>
    </Card>
  );
}

// ── Host readiness (U-14) ─────────────────────────────────────────────────

function HostReadinessCheck({
  hostToken,
  agent,
  heartbeat,
  agentKeyBound,
  hasActiveSession,
}: {
  hostToken: string;
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  hasActiveSession: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<HostReadinessResult | null>(null);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      let apiOk = false;
      let enabledGamesCount = 0;
      let serverHasActiveSession = hasActiveSession;
      let serverAgentKeyBound = agentKeyBound;
      let serverHeartbeatFresh = heartbeat.status === "fresh";

      try {
        const server = await getHostReadiness({
          headers: {
            Authorization: `Bearer ${hostToken}`,
            "X-User-Token": hostToken,
            "X-Host-Token": hostToken,
          },
        });
        apiOk = server.apiOk;
        enabledGamesCount = server.enabledGamesCount;
        serverHasActiveSession = server.hasActiveSession;
        serverAgentKeyBound = server.agentKeyBound;
        serverHeartbeatFresh = server.heartbeatFresh;
      } catch {
        apiOk = false;
      }

      const localProbe = await probeAgentReadiness({ force: true });
      const localAgentReachable = localProbe != null;
      const localInputOk = localProbe?.inputOk === true;
      const goOnlineAck = readHostGoOnlineAck();

      const heartbeatForEval: HeartbeatState = serverHeartbeatFresh
        ? heartbeat.status === "fresh"
          ? heartbeat
          : { status: "fresh", lastSeenAt: new Date().toISOString() }
        : heartbeat;

      const evaluated = evaluateHostReadiness({
        apiOk,
        agentKeyBound: serverAgentKeyBound,
        heartbeat: heartbeatForEval,
        agent: localAgentReachable
          ? {
              status: "online",
              version: localProbe?.version ?? "?",
              audioMode: (localProbe?.audioMode ?? "off") as AudioMode,
              port: localProbe?.port ?? 18080,
            }
          : agent.status === "checking"
            ? { status: "offline" }
            : agent,
        enabledGamesCount,
        hasActiveSession: serverHasActiveSession,
        goOnlineAck,
        localAgentReachable,
        localInputOk,
      });

      setResult(evaluated);
      if (evaluated.ready) {
        toast.success(evaluated.headline);
      } else {
        toast.error(evaluated.nextFix ?? evaluated.headline);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card style={cardStyle} data-testid="host-readiness-check">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          Проверка готовности
        </CardTitle>
        <CardDescription className="text-slate-500 text-xs">
          Одна кнопка проверяет API, агент, привязку, игру, сессию и локальный ввод.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="sm"
          className="gap-2 font-semibold"
          style={{ background: "#0ea5e9", color: "#fff" }}
          onClick={() => void runCheck()}
          disabled={checking}
          data-testid="button-check-host-readiness"
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {checking ? "Проверяем…" : "Проверить готовность"}
        </Button>

        {result && (
          <div
            className="rounded-lg p-3 space-y-2 text-sm"
            style={{
              background: result.ready
                ? "rgba(16,185,129,0.08)"
                : "rgba(245,158,11,0.06)",
              border: result.ready
                ? "1px solid rgba(16,185,129,0.25)"
                : "1px solid rgba(245,158,11,0.25)",
            }}
            data-testid="host-readiness-result"
          >
            <p
              className={`font-semibold ${result.ready ? "text-emerald-300" : "text-amber-200"}`}
            >
              {result.headline}
            </p>
            {result.nextFix && (
              <p className="text-slate-300 text-xs">{result.nextFix}</p>
            )}
            <ul className="space-y-1 text-xs text-slate-400">
              {result.checks.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span aria-hidden>{c.ok ? "✓" : "✗"}</span>
                  <span className={c.ok ? "text-emerald-400/90" : "text-amber-300/90"}>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────

interface PcSpecs {
  gpu: string;
  cpu: string;
  ramGb: number;
}

export default function Dashboard() {
  const { hostToken } = useAuth();
  const [agent, setAgent] = useState<AgentState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void pingAgent().then((state) => {
        if (!cancelled) setAgent(state);
      });
    };
    tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // Server-side heartbeat via React Query — agent POSTs every ~15s.
  const { data: hostMe } = useGetHost(hostToken || "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetHostQueryKey(hostToken || ""),
      refetchInterval: 30_000, // heartbeat badge only — 30s is plenty
    },
  });

  const pcSpecs = (hostMe as { pcSpecs?: PcSpecs | null } | undefined)?.pcSpecs ?? null;
  const heartbeat = resolveHeartbeatState(hostMe?.lastSeenAt, !!hostMe);

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

  const { data: libraryEntries } = useListHostLibrary(hostToken || "", {
    query: {
      enabled: !!hostToken,
      queryKey: getListHostLibraryQueryKey(hostToken || ""),
    },
  });

  const agentKeyBound = !!(hostMe as { agentKeyBound?: boolean } | undefined)?.agentKeyBound;
  const libraryCount = libraryEntries?.length ?? 0;
  const hasActiveSession = (sessions ?? []).some(
    (s) => s.status === "active" || s.status === "pending",
  );
  const hasFirstStream = hasCompletedFirstStream(sessions);
  const onboarding = !hasFirstStream;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const agentNeedsAttention = agentNeedsAdvancedPanel(agent, heartbeat);

  useEffect(() => {
    if (agentNeedsAttention && agent.status !== "checking") {
      setAdvancedOpen(true);
    }
  }, [agentNeedsAttention, agent.status]);

  const endSession = useEndSession();
  const [endSessionId, setEndSessionId] = useState<string | null>(null);

  const handleCopyLink = (s: { playerToken: string; inviteCode?: string | null }) => {
    const link = buildPlayerPlayLink({
      origin: window.location.origin,
      baseUrl: import.meta.env.BASE_URL,
      playerToken: s.playerToken,
      inviteCode: s.inviteCode,
    });
    void navigator.clipboard.writeText(link).then(
      () =>
        toast.success(
          s.inviteCode ? "Безопасная ссылка скопирована" : "Ссылка скопирована",
        ),
      () => toast.error("Не удалось скопировать ссылку"),
    );
  };

  const [testLoading, setTestLoading] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const handleTestSession = async () => {
    if (!hostToken) return;
    setTestLoading(true);
    try {
      const trimmedUrl = testUrl.trim();
      const data = await createTestSession(
        trimmedUrl ? { overrideUrl: trimmedUrl } : undefined,
        {
          headers: {
            "X-Host-Token": hostToken,
            Authorization: `Bearer ${hostToken}`,
            "X-User-Token": hostToken,
          },
        },
      );
      refetchSessions();
      const target = resolveTestSessionOpenTarget(data);
      if (target.kind === "host-play") {
        // Arbitrary external site: iframes are blocked by most sites, so the
        // honest test is a real WebRTC stream. Open the host streaming page
        // where the host shares their tab; the guest link is shown there.
        try {
          const keys = buildBrowserHostStorageKeys(data.session.id);
          localStorage.setItem(keys.hostTokenKey, hostToken);
          localStorage.setItem(keys.browserHostUrlKey, data.hostBoundUrl ?? "");
        } catch {
          // localStorage unavailable — the host page will show an error
        }
        toast.success("Тест-сессия создана — поделись вкладкой со стримом");
      } else {
        toast.success("Тест-сессия создана — открываю плеер");
      }
      window.open(
        buildTestSessionFullUrl(
          window.location.origin,
          import.meta.env.BASE_URL,
          target,
        ),
        "_blank",
      );
    } catch (err) {
      toast.error(formatApiError(err, "Ошибка сети при создании тест-сессии"));
    } finally {
      setTestLoading(false);
    }
  };

  const handleEndSession = () => {
    if (!hostToken || !endSessionId) return;
    const id = endSessionId;
    endSession.mutate(
      { id, data: { hostToken } },
      {
        onSuccess: () => {
          toast.success("Сессия завершена");
          setEndSessionId(null);
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
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Дашборд хоста
        </h1>
        <p className="text-sm text-slate-500">
          {onboarding
            ? "Одно следующее действие — до первого стрима"
            : "Статистика, шаблоны и сессии"}
        </p>
      </div>

      {hostToken && (
        <HostQuickStartCard
          hostToken={hostToken}
          agent={agent}
          heartbeat={heartbeat}
          agentKeyBound={agentKeyBound}
          libraryCount={libraryCount}
          hasActiveSession={hasActiveSession}
          hasFirstStream={hasFirstStream}
          onTestStream={() => void handleTestSession()}
          testLoading={testLoading}
        />
      )}

      {/* PC Specs card — shown only when the agent has reported specs */}
      {!onboarding && pcSpecs && (
        <Card style={cardStyle}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <HardDrive className="h-4 w-4 text-sky-400" />
              Характеристики ПК хоста
            </CardTitle>
            <CardDescription className="text-slate-500">
              Железо, с которого ведётся стриминг.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono flex items-center gap-1">
                  <Monitor className="h-3 w-3" /> GPU
                </div>
                <div className="text-sm font-semibold text-white truncate" title={pcSpecs.gpu}>
                  {pcSpecs.gpu}
                </div>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> CPU
                </div>
                <div className="text-sm font-semibold text-white truncate" title={pcSpecs.cpu}>
                  {pcSpecs.cpu}
                </div>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-mono flex items-center gap-1">
                  <MemoryStick className="h-3 w-3" /> RAM
                </div>
                <div className="text-sm font-semibold text-white">
                  {pcSpecs.ramGb} GB
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <details
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)", background: "#0a1018" }}
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-400 hover:text-white select-none">
          {onboarding
            ? "Если не работает — диагностика и привязка"
            : "Расширенно — тест-сессия, привязка игры, квоты"}
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          {hostToken && (
            <HostReadinessCheck
              hostToken={hostToken}
              agent={agent}
              heartbeat={heartbeat}
              agentKeyBound={agentKeyBound}
              hasActiveSession={hasActiveSession}
            />
          )}

          {!onboarding && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="https://… или пусто"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !testLoading) void handleTestSession();
                  }}
                  className="w-64 text-sm"
                  style={{
                    background: "#06090e",
                    borderColor: "rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                  data-testid="input-test-url"
                />
                <Button
                  onClick={() => void handleTestSession()}
                  disabled={testLoading || !hostToken}
                  className="bg-violet-600 hover:bg-violet-500 text-white shrink-0"
                  data-testid="button-test-session-advanced"
                >
                  <FlaskConical className="h-4 w-4 mr-2" />
                  {testLoading ? "Создаём..." : "Проверить самому"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Тест-сессия для себя — не на критическом пути онбординга
              </p>
            </div>
          )}

          {hostToken && !agentKeyBound && (
            <AgentBindCodeCard hostToken={hostToken} />
          )}

          {!onboarding && agent.status !== "checking" && (
            <AgentStatusCard agent={agent} heartbeat={heartbeat} />
          )}

          {onboarding && agent.status !== "checking" && (
            <AgentTroubleshootChecklist agent={agent} heartbeat={heartbeat} />
          )}

          {hostToken && <AgentEventsCard hostToken={hostToken} />}
        </div>
      </details>

      {!onboarding && (
      <>
      {/* Stats */}
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
              Игровой баланс
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
              ≈ ${((stats?.internalBalanceLzt ?? 0) / 200).toFixed(2)} · для трат на платформе
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
              К выводу
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

      {/* Current quota status */}
      {hostToken && <CurrentQuotaCard hostToken={hostToken} />}

      {/* Host templates list */}
      {hostToken && <HostTemplates hostToken={hostToken} />}

      {/* Sessions + Activity feed */}
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
                          {formatDistanceToNow(new Date(session.createdAt), { locale: ru })} назад
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
                            onClick={() => handleCopyLink(session)}
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
                            onClick={() => setEndSessionId(session.id)}
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
                        {formatDistanceToNow(new Date(item.timestamp), { locale: ru })} назад
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
      </>
      )}

      <Dialog
        open={!!endSessionId}
        onOpenChange={(v) => {
          if (!v) setEndSessionId(null);
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Завершить сессию?</DialogTitle>
            <DialogDescription className="text-slate-500">
              Игрок будет отключён, биллинг остановится. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEndSessionId(null)}
              className="text-slate-400"
            >
              Отмена
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={endSession.isPending}
              onClick={handleEndSession}
            >
              {endSession.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Завершить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
