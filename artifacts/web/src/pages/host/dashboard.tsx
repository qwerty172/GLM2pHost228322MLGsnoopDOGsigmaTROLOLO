import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
};

// ── Agent ping check ──────────────────────────────────────────────────────

type AudioMode = "off" | "voice" | "standard" | "quality";

type AgentState =
  | { status: "checking" }
  | { status: "online"; version: string; audioMode: AudioMode }
  | { status: "offline" };

const AUDIO_MODE_LABELS: Record<AudioMode, string> = {
  off: "Без звука",
  voice: "Голос ~12kbps",
  standard: "Стандарт ~32kbps",
  quality: "Качество ~64kbps",
};

async function pingAgent(): Promise<AgentState> {
  try {
    const res = await fetch("http://localhost:18080/ping", {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = (await res.json()) as { version?: string; audioMode?: string };
      const audioMode = (data.audioMode ?? "off") as AudioMode;
      return { status: "online", version: data.version ?? "?", audioMode };
    }
    return { status: "offline" };
  } catch {
    return { status: "offline" };
  }
}

function AgentStatusCard({ agent }: { agent: AgentState }) {
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
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
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
              href="http://localhost:18080"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 h-8 text-xs text-slate-400 hover:text-white"
              >
                <Wifi className="h-3 w-3" />
                localhost:18080
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <WifiOff className="h-4 w-4 text-sky-400" />
          Установить агент хоста
        </CardTitle>
        <CardDescription className="text-slate-400">
          Агент запускается на Windows-ПК и стримит окно игры по WebRTC.
          Скачай ZIP, распакуй и запусти{" "}
          <span className="font-mono text-xs text-sky-400">start.bat</span>.
          Нужен Node.js 20+ (см.{" "}
          <span className="font-mono text-xs text-sky-400">INSTALL.txt</span>{" "}
          внутри архива).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {[
            "Стриминг окна игры по WebRTC",
            "Авто-запуск игр",
            "95% выплата хосту",
          ].map((f) => (
            <span
              key={f}
              className="text-[11px] px-2 py-0.5 rounded-full text-sky-300"
              style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}
            >
              {f}
            </span>
          ))}
        </div>
        <a
          href="/api/downloads/host-agent.zip"
          download="cloud-gaming-host-agent.zip"
          data-testid="link-download-host-agent"
          className="ml-auto"
        >
          <Button
            className="gap-2 h-9 font-semibold"
            style={{ background: "#0ea5e9", color: "#fff" }}
          >
            <Download className="h-4 w-4" />
            Скачать агент (.zip)
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

// ── Host library templates ────────────────────────────────────────────────

interface LibraryTemplate {
  id: string;
  gameId: string;
  pricePerMinuteLzt: number;
  enabled: boolean;
  hasActiveSession: boolean;
  game: {
    id: string;
    title: string;
    coverImageUrl: string | null;
    browserHostUrl: string | null;
  };
}

async function apiFetch<T>(
  url: string,
  opts?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const token = localStorage.getItem("streamline.hostToken");
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-User-Token": token } : {}),
        ...(opts?.headers ?? {}),
      },
    });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json?.error ?? "Ошибка сервера" };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "Нет соединения" };
  }
}

function HostTemplates({ hostToken }: { hostToken: string }) {
  const [entries, setEntries] = useState<LibraryTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    const r = await apiFetch<LibraryTemplate[]>(`/api/hosts/@me/library`);
    setLoading(false);
    if (r.ok) setEntries(r.data);
  };

  useEffect(() => {
    fetchEntries();
  }, [hostToken]);

  const handleDelete = async (entry: LibraryTemplate) => {
    if (entry.hasActiveSession) return;
    setRemoving(entry.gameId);
    const r = await apiFetch(`/api/hosts/@me/library/${entry.gameId}`, {
      method: "DELETE",
    });
    setRemoving(null);
    if (r.ok) {
      toast.success(`«${entry.game.title}» удалена из шаблонов`);
      setEntries((prev) => prev?.filter((e) => e.gameId !== entry.gameId) ?? []);
    } else {
      toast.error("Не удалось удалить шаблон");
    }
  };

  return (
    <Card style={cardStyle}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-white">
            <Gamepad2 className="h-5 w-5 text-sky-400" />
            Мои шаблоны хостинга
          </CardTitle>
          <CardDescription className="text-slate-500 mt-0.5">
            Настроенные игры и цены — готовы к запуску.
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
                        {isBrowser ? "browser" : "native"}
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
                      onClick={() => handleDelete(entry)}
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
  );
}

// ── Current quota card ────────────────────────────────────────────────────

interface CurrentQuotaInfo {
  quota: {
    id: string;
    title: string;
    kind: string;
    escrowRemainingLzt: number | null;
    budgetLzt: number | null;
  } | null;
  sessionId?: string;
}

function CurrentQuotaCard({ hostToken }: { hostToken: string }) {
  const [info, setInfo] = useState<CurrentQuotaInfo | null>(null);
  const [detaching, setDetaching] = useState(false);

  const fetchCurrent = async () => {
    const r = await apiFetch<CurrentQuotaInfo>(`/api/hosts/me/current-quota`);
    if (r.ok) setInfo(r.data);
  };

  useEffect(() => {
    fetchCurrent();
    const t = setInterval(fetchCurrent, 15_000);
    return () => clearInterval(t);
  }, [hostToken]);

  const handleDetach = async () => {
    setDetaching(true);
    const r = await apiFetch(`/api/hosts/me/detach-quota`, {
      method: "POST",
      body: JSON.stringify({ hostToken }),
    });
    setDetaching(false);
    if (r.ok) {
      toast.success("Квота отвязана");
      fetchCurrent();
    } else {
      toast.error("Не удалось отвязать квоту");
    }
  };

  if (!info) return null;

  return (
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
                  ? `Sponsor · ${(info.quota.escrowRemainingLzt ?? 0).toLocaleString("ru-RU")} LZT осталось`
                  : `Royalty`}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:text-white hover:border-red-400"
              onClick={handleDetach}
              disabled={detaching}
            >
              {detaching ? (
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
  const [pcSpecs, setPcSpecs] = useState<PcSpecs | null>(null);

  useEffect(() => {
    let cancelled = false;
    pingAgent().then((state) => {
      if (!cancelled) setAgent(state);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hostToken) return;
    fetch(`/api/hosts/@me`, { headers: { "X-User-Token": hostToken } })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { pcSpecs?: PcSpecs | null } | null) => {
        if (data?.pcSpecs) setPcSpecs(data.pcSpecs);
      })
      .catch(() => {});
  }, [hostToken]);

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

  const [testLoading, setTestLoading] = useState(false);
  const handleTestSession = async () => {
    if (!hostToken) return;
    setTestLoading(true);
    try {
      const res = await fetch(`/api/sessions/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Не удалось создать тест-сессию");
        return;
      }
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
        window.open(
          `${window.location.origin}${import.meta.env.BASE_URL}play/${data.session.playerToken}`,
          "_blank",
        );
      }
    } catch {
      toast.error("Ошибка сети при создании тест-сессии");
    } finally {
      setTestLoading(false);
    }
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
        <Button
          onClick={handleTestSession}
          disabled={testLoading || !hostToken}
          className="bg-violet-600 hover:bg-violet-500 text-white"
          data-testid="button-test-session"
        >
          <FlaskConical className="h-4 w-4 mr-2" />
          {testLoading ? "Создаём..." : "Проверить самому"}
        </Button>
      </div>

      {/* Agent status */}
      <AgentStatusCard agent={agent} />

      {hostToken && <BindingForm hostToken={hostToken} />}

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
