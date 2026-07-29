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
  useAddHostLibraryEntry,
  useListGames,
  getGetHostQueryKey,
  getGetHostStatsQueryKey,
  getGetHostActivityQueryKey,
  getListHostSessionsQueryKey,
  getGetHostCurrentQuotaQueryKey,
  getListHostLibraryQueryKey,
  getListGamesQueryKey,
  issueAgentBindCode,
  createTestSession,
  type HostLibraryEntry,
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
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "wouter";
import { discoverAgentPort } from "@/lib/agent-local";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

// ── Agent ping check ──────────────────────────────────────────────────────

type AudioMode = "off" | "voice" | "standard" | "quality";

type AgentState =
  | { status: "checking" }
  | { status: "online"; version: string; audioMode: AudioMode; port: number }
  | { status: "offline" };

// Heartbeat freshness: the agent sends a heartbeat to the API every 15s.
// If lastSeenAt is fresher than this, the agent is considered connected even
// when the local ping fails (agent may run on a different PC than the browser).
const HEARTBEAT_FRESH_MS = 45_000;

type HeartbeatState =
  | { status: "unknown" }
  | { status: "fresh"; lastSeenAt: string }
  | { status: "stale"; lastSeenAt: string }
  | { status: "never" };

const AUDIO_MODE_LABELS: Record<AudioMode, string> = {
  off: "Без звука",
  voice: "Голос ~12kbps",
  standard: "Стандарт ~32kbps",
  quality: "Качество ~64kbps",
};

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

const AGENT_SYMPTOM_ROWS = [
  {
    symptom: "Агент не запускается / окно сразу закрывается",
    fix: "Установи Node.js 20+ (node --version), запусти start.bat от имени администратора.",
  },
  {
    symptom: "localhost:18080 недоступен в браузере",
    fix: "Разреши порты 18080–18083 в файрволе/антивирусе; агент должен быть запущен на этом ПК.",
  },
  {
    symptom: "На дашборде «Агент онлайн», но стрим не идёт",
    fix: "Проверь привязку кода, выбери игру в агенте и нажми «Выйти в онлайн».",
  },
  {
    symptom: "Heartbeat устарел — агент был, но пропал",
    fix: "Не закрывай окно агента; проверь интернет и что токен хоста не сменился.",
  },
  {
    symptom: "Игра не захватывается / чёрный экран",
    fix: "Запусти start.bat от администратора; для полноэкранных игр попробуй оконный режим.",
  },
  {
    symptom: "В событиях агента ERROR / FATAL",
    fix: "Прочитай текст ошибки ниже; перезапусти агент и обнови до последней версии ZIP.",
  },
] as const;

function AgentTroubleshootChecklist() {
  return (
    <details className="w-full mt-2" data-testid="agent-troubleshoot">
      <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 select-none">
        Если не работает — таблица симптомов
      </summary>
      <div className="mt-2 overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-xs text-left" data-testid="agent-symptom-table">
          <thead>
            <tr className="border-b border-white/5 text-slate-500">
              <th className="px-2 py-1.5 font-medium">Симптом</th>
              <th className="px-2 py-1.5 font-medium">Что сделать</th>
            </tr>
          </thead>
          <tbody>
            {AGENT_SYMPTOM_ROWS.map((row) => (
              <tr key={row.symptom} className="border-b border-white/5 last:border-0">
                <td className="px-2 py-1.5 text-slate-300 align-top whitespace-normal min-w-[9rem]">
                  {row.symptom}
                </td>
                <td className="px-2 py-1.5 text-slate-400 align-top whitespace-normal">
                  {row.fix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ── Agent telemetry events ────────────────────────────────────────────────
// The agent pushes startup/error events to the server; this card makes them
// visible on the dashboard so a silently-dying agent still leaves a trace.

const EVENT_LEVEL_STYLES: Record<string, { badge: string; label: string }> = {
  fatal: { badge: "bg-red-500/15 text-red-300 border-red-500/30", label: "FATAL" },
  error: { badge: "bg-red-500/10 text-red-400 border-red-500/20", label: "ERROR" },
  warn: { badge: "bg-amber-500/10 text-amber-300 border-amber-500/20", label: "WARN" },
  info: { badge: "bg-slate-500/10 text-slate-400 border-slate-500/20", label: "INFO" },
};

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
              const style = EVENT_LEVEL_STYLES[e.level] ?? EVENT_LEVEL_STYLES.info;
              return (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold ${style.badge}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-slate-300 break-all whitespace-pre-wrap flex-1">
                    {e.message}
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
  // Stale heartbeat: agent was connected but stopped sending heartbeats.
  if (heartbeat.status === "stale") {
    return (
      <Card
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        <CardHeader className="pb-2" data-testid="agent-status-stale">
          <CardTitle className="flex items-center gap-2 text-base text-amber-200 mb-1">
            <Clock className="h-4 w-4 text-amber-400" />
            Heartbeat устарел
          </CardTitle>
          <CardDescription className="text-amber-200/70 text-xs">
            Агент был на связи{" "}
            {formatDistanceToNow(new Date(heartbeat.lastSeenAt), { addSuffix: true, locale: ru })}
            , но перестал отправлять heartbeat. Проверь, что{" "}
            <span className="font-mono text-amber-100">start.bat</span> всё ещё запущен.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {agent.status === "online" ? (
            <p className="text-xs text-slate-400 mb-2">
              Локальный ping отвечает (v{agent.version} на порту {agent.port}), но сервер не
              получает heartbeat — проверь токен хоста и интернет на машине с агентом.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mb-2">
              Локальный ping не отвечает — агент, скорее всего, закрыт или упал. Перезапусти{" "}
              <span className="font-mono text-sky-400">start.bat</span> и посмотри «События агента»
              ниже.
            </p>
          )}
          <AgentTroubleshootChecklist />
        </CardContent>
      </Card>
    );
  }

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
          <a
            href="/api/downloads/host-agent.zip"
            download="cloud-gaming-host-agent.zip"
            data-testid="link-download-host-agent"
          >
            <Button
              size="sm"
              className="gap-2 h-8 text-xs font-semibold shrink-0"
              style={{ background: "#0ea5e9", color: "#fff" }}
            >
              <Download className="h-3.5 w-3.5" />
              Скачать агент
            </Button>
          </a>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="space-y-1.5 text-xs text-slate-400">
          {[
            { n: "1", text: "Скачай ZIP и распакуй в любую папку (например C:\\CloudAgent)" },
            { n: "2", text: "Дважды кликни start.bat — при первом запуске установит Node.js зависимости (~2 мин)" },
            { n: "3", text: "В окне агента вставь токен хоста (скопируй ниже) и нажми Сохранить" },
            { n: "4", text: "Выбери игру и нажми Выйти в онлайн — эта страница покажет «Агент онлайн ✓»" },
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
        <AgentTroubleshootChecklist />
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
}: {
  hostToken: string;
  agent: AgentState;
  heartbeat: HeartbeatState;
  agentKeyBound: boolean;
  libraryCount: number;
  hasActiveSession: boolean;
}) {
  const agentOnline =
    agent.status === "online" || heartbeat.status === "fresh";
  const steps = [
    {
      done: true,
      title: "Скачай агент",
      hint: "ZIP → start.bat на Windows-ПК",
    },
    {
      done: agentOnline,
      title: "Агент онлайн",
      hint: agentOnline
        ? agent.status === "online"
          ? `localhost:${agent.port}`
          : "на связи через heartbeat"
        : "Запусти start.bat",
    },
    {
      done: agentKeyBound,
      title: "Агент привязан",
      hint: "Код привязки ниже → вставь в агенте",
    },
    {
      done: libraryCount > 0,
      title: "Добавь игру",
      hint: libraryCount > 0 ? `${libraryCount} в библиотеке` : "Одна игра — и можно стримить",
    },
    {
      done: hasActiveSession || (agentOnline && libraryCount > 0 && agentKeyBound),
      title: "В онлайн",
      hint: hasActiveSession
        ? "Принимаешь игроков"
        : "В агенте нажми «Выйти в онлайн»",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  const copyToken = () => {
    void navigator.clipboard.writeText(hostToken).then(
      () => toast.success("Токен скопирован"),
      () => toast.error("Не удалось скопировать"),
    );
  };

  return (
    <Card
      style={{
        background: allDone ? "rgba(16,185,129,0.06)" : "rgba(14,165,233,0.05)",
        border: allDone
          ? "1px solid rgba(16,185,129,0.3)"
          : "1px solid rgba(14,165,233,0.25)",
      }}
      data-testid="host-quick-start"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white text-base flex items-center gap-2">
              {allDone ? (
                <Wifi className="h-4 w-4 text-emerald-400" />
              ) : (
                <Gamepad2 className="h-4 w-4 text-sky-400" />
              )}
              {allDone ? "Готов принимать игроков" : "Быстрый старт"}
            </CardTitle>
            <CardDescription className="text-slate-500">
              {doneCount} из {steps.length} шагов
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={copyToken}
              data-testid="button-copy-host-token"
            >
              <Copy className="h-3 w-3" />
              Скопировать токен
            </Button>
            <a href="/api/downloads/host-agent.zip" download="cloud-gaming-host-agent.zip">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Download className="h-3.5 w-3.5" />
                Скачать агент
              </Button>
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span
                className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                style={{
                  background: s.done
                    ? "rgba(16,185,129,0.2)"
                    : "rgba(14,165,233,0.12)",
                  color: s.done ? "#34d399" : "#38bdf8",
                }}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${s.done ? "text-emerald-300" : "text-white"}`}>
                  {s.title}
                </p>
                <p className="text-xs text-slate-500">{s.hint}</p>
              </div>
            </li>
          ))}
        </ol>

        {!agentOnline && (
          <div className="rounded-lg p-3 text-xs text-slate-400" style={{ background: "rgba(0,0,0,0.25)" }}>
            После установки запусти <span className="font-mono text-sky-400">start.bat</span>.
            Агент уйдёт в трей — окно настроек открой по клику на иконку.
            <AgentTroubleshootChecklist />
          </div>
        )}

        {agentOnline && !agentKeyBound && (
          <AgentBindCodeCard hostToken={hostToken} />
        )}

        {agentKeyBound && libraryCount === 0 && (
          <QuickAddFirstGame hostToken={hostToken} />
        )}

        {agentKeyBound && libraryCount > 0 && !hasActiveSession && (
          <p className="text-xs text-slate-400">
            В агенте нажми <span className="text-sky-300 font-medium">«Выйти в онлайн»</span> —
            игроки увидят тебя в каталоге.
            <a href="decenthub://open" className="text-sky-400 hover:underline ml-1">
              Открыть агент
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QuickAddFirstGame({ hostToken }: { hostToken: string }) {
  const [q, setQ] = useState("");
  const [appPath, setAppPath] = useState("");
  const [price, setPrice] = useState("10");
  const [busy, setBusy] = useState(false);
  const addEntry = useAddHostLibraryEntry();
  const queryClient = useQueryClient();

  const listParams = { search: q.trim() || undefined } as Record<
    string,
    string | undefined
  >;
  const { data: games } = useListGames(listParams, {
    query: {
      enabled: q.trim().length >= 2,
      staleTime: 30_000,
      queryKey: getListGamesQueryKey(listParams),
    },
  });

  const picks = (games ?? []).slice(0, 5);

  const addGame = async (gameId: string, title: string) => {
    const pricePerMinuteLzt = Math.max(0, Number(price) || 0);
    if (!appPath.trim()) {
      toast.error("Укажи путь к .exe игры на этом ПК");
      return;
    }
    setBusy(true);
    try {
      await addEntry.mutateAsync({
        hostToken,
        data: {
          gameId,
          pricePerMinuteLzt,
          appPath: appPath.trim(),
          boundUrl: "",
          launchArgs: "",
        },
      });
      toast.success(`«${title}» добавлена`);
      void queryClient.invalidateQueries({
        queryKey: getListHostLibraryQueryKey(hostToken),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-lg p-3 space-y-3"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid="quick-add-first-game"
    >
      <p className="text-sm font-medium text-white">Первая игра</p>
      <Input
        placeholder="Поиск в каталоге…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-8 text-sm"
        style={{ background: "#0a1018", borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
      />
      <Input
        placeholder="C:\Games\Game\game.exe"
        value={appPath}
        onChange={(e) => setAppPath(e.target.value)}
        className="h-8 text-sm font-mono"
        style={{ background: "#0a1018", borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-8 w-24 text-sm"
          style={{ background: "#0a1018", borderColor: "rgba(255,255,255,0.12)", color: "#fff" }}
        />
        <span className="text-xs text-slate-500">LZT/мин</span>
        <Link href="/host/library" className="ml-auto text-xs text-sky-400 hover:underline">
          Полная библиотека →
        </Link>
      </div>
      {picks.length > 0 && (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {picks.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void addGame(g.id, g.title)}
                className="w-full text-left px-2 py-1.5 rounded text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                {g.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentBindCodeCard({ hostToken }: { hostToken: string }) {
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

  return (
    <Card style={cardStyle}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white text-base">
          <KeyRound className="h-4 w-4 text-sky-400" />
          Код привязки агента
        </CardTitle>
        <CardDescription className="text-slate-500">
          Одноразовый код вместо долгоживущего токена — вставь его в агенте при привязке ключа.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
              : "Код ещё не создан. Действует короткое время и сгорает после использования."}
          </p>
        )}
        <Button
          size="sm"
          className="gap-1.5 h-8 text-xs font-semibold"
          style={{ background: "#0ea5e9", color: "#fff" }}
          onClick={() => void issueCode()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {bindCode && !expired ? "Выдать новый код" : "Получить код"}
        </Button>
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
  const heartbeat: HeartbeatState = (() => {
    if (!hostMe) return { status: "unknown" };
    const lastSeenAt = hostMe.lastSeenAt;
    if (!lastSeenAt) return { status: "never" };
    if (Date.now() - new Date(lastSeenAt).getTime() < HEARTBEAT_FRESH_MS) {
      return { status: "fresh", lastSeenAt };
    }
    return { status: "stale", lastSeenAt };
  })();

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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: agentEvents } = useGetHostAgentEvents(hostToken || "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetHostAgentEventsQueryKey(hostToken || ""),
      refetchInterval: 30_000,
    },
  });
  const hasAgentErrors = (agentEvents ?? []).some(
    (e) => e.level === "error" || e.level === "fatal",
  );

  // UX-02: auto-expand advanced section when agent needs attention.
  useEffect(() => {
    const needsAttention =
      agent.status === "offline" ||
      heartbeat.status === "stale" ||
      hasAgentErrors;
    if (needsAttention) setAdvancedOpen(true);
  }, [agent.status, heartbeat.status, hasAgentErrors]);

  const endSession = useEndSession();
  const [endSessionId, setEndSessionId] = useState<string | null>(null);

  const handleCopyLink = (s: { playerToken: string; inviteCode?: string | null }) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const link = s.inviteCode
      ? `${window.location.origin}${base}/play/i/${s.inviteCode}`
      : `${window.location.origin}${base}/play/${s.playerToken}`;
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
      if (data.isExternalUrl && data.hostBoundUrl) {
        // Arbitrary external site: iframes are blocked by most sites, so the
        // honest test is a real WebRTC stream. Open the host streaming page
        // where the host shares their tab; the guest link is shown there.
        try {
          localStorage.setItem(
            "streamline.browserHostToken:" + data.session.id,
            hostToken,
          );
          localStorage.setItem(
            "streamline.browserHostUrl:" + data.session.id,
            data.hostBoundUrl,
          );
        } catch {
          // localStorage unavailable — the host page will show an error
        }
        toast.success("Тест-сессия создана — поделись вкладкой со стримом");
        window.open(
          `${window.location.origin}${import.meta.env.BASE_URL}host/play/${data.session.id}`,
          "_blank",
        );
      } else {
        toast.success("Тест-сессия создана — открываю плеер");
        const playPath = data.session.inviteCode
          ? `play/i/${data.session.inviteCode}`
          : `play/${data.session.playerToken}`;
        window.open(
          `${window.location.origin}${import.meta.env.BASE_URL}${playPath}`,
          "_blank",
        );
      }
    } catch (err) {
      const msg =
        (err as { data?: { error?: string; message?: string } }).data?.message ??
        (err as { data?: { error?: string } }).data?.error;
      toast.error(msg ?? "Ошибка сети при создании тест-сессии");
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
          Пять шагов до приёма игроков — без лишних экранов.
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
        />
      )}

      {/* PC Specs card — shown only when the agent has reported specs */}
      {pcSpecs && (
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
          Расширенно — тест-сессия, привязка игры, квоты
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
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
                data-testid="button-test-session"
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                {testLoading ? "Создаём..." : "Проверить самому"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Тест-сессия для себя — не на критическом пути онбординга
            </p>
          </div>

          {hostToken && !agentKeyBound && <AgentBindCodeCard hostToken={hostToken} />}

          {hostToken && <BindingForm hostToken={hostToken} />}

          {agent.status !== "checking" && (
            <AgentStatusCard agent={agent} heartbeat={heartbeat} />
          )}

          {hostToken && <AgentEventsCard hostToken={hostToken} />}
        </div>
      </details>

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
