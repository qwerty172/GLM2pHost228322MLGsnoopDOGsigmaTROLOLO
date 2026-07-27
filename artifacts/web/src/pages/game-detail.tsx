import { Link, useParams, useSearch, useLocation } from "wouter";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetGameBySlug,
  getGetGameBySlugQueryKey,
  useGetWallet,
  getGetWalletQueryKey,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Eye,
  Gamepad2,
  Loader2,
  Play,
  Server,
  Star,
  Trophy,
  Users,
  Wand2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import type { ScheduleSlot } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { GameNotifyButton } from "@/components/game-notify-button";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

const LZT_PER_USD = 200;
const DEFAULT_CREDIT_LZT = 3000;

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
function formatScheduleSummary(slots: ScheduleSlot[]): string {
  if (!slots || slots.length === 0) return "нет слотов";
  return (
    slots
      .slice(0, 3)
      .map((s) => {
        const fmt = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        return `${DAY_LABELS[s.day] ?? "?"} ${fmt(s.startMin)}–${fmt(s.endMin)}`;
      })
      .join(", ") + (slots.length > 3 ? "…" : "")
  );
}

const chip = (active: boolean) => ({
  background: active ? "#0ea5e9" : "rgba(14,165,233,0.08)",
  color: active ? "#fff" : "#7dd3fc",
  border: active ? "1px solid #0ea5e9" : "1px solid rgba(14,165,233,0.18)",
});

type GameEnriched = {
  steamAppId?: string | null;
};

function SteamPlayerCount({ steamAppId }: { steamAppId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    fetch(`${base}/api/games/steam-lookup?appId=${steamAppId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.currentPlayers != null) setCount(d.currentPlayers); })
      .catch(() => {});
  }, [steamAppId]);
  if (count == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1 font-mono">
      <Activity className="h-3 w-3" />
      {count.toLocaleString("ru-RU")} играют в Steam
    </span>
  );
}

type LibraryHost = {
  hostId: string;
  displayName: string;
  tags: string[];
  description: string | null;
  pricePerMinuteLzt: number;
  pricePerMinuteUsd: number;
  status: "online" | "available" | "scheduled";
  inviteCode: string | null;
  scheduleMode: string;
  pingMs: number | null;
  hostTier?: "meets_min" | "above_rec";
};

function useLibraryHosts(slug: string) {
  return useQuery<LibraryHost[]>({
    queryKey: ["public-game-hosts", slug],
    queryFn: async () => {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const res = await fetch(`${base}/api/public/games/${encodeURIComponent(slug)}/hosts`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

function useBrowserPingMs(): number | null {
  const [pingMs, setPingMs] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      try {
        const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
        const t0 = Date.now();
        await fetch(`${base}/api/public/ping`, { cache: "no-store" });
        if (!cancelled) setPingMs(Date.now() - t0);
      } catch {
        // ignore — just leave null
      }
    }
    void probe();
    return () => { cancelled = true; };
  }, []);
  return pingMs;
}

function sortHostsByLatency(hosts: LibraryHost[], browserRtt: number | null): LibraryHost[] {
  const tierRank = (t: unknown) => (t === "above_rec" ? 0 : 1);
  return [...hosts].sort((a, b) => {
    // Recommended-and-above hosts always come first, regardless of latency.
    const tierDiff = tierRank(a.hostTier) - tierRank(b.hostTier);
    if (tierDiff !== 0) return tierDiff;
    const scoreA = a.pingMs != null ? (browserRtt ?? 0) + a.pingMs : Infinity;
    const scoreB = b.pingMs != null ? (browserRtt ?? 0) + b.pingMs : Infinity;
    return scoreA - scoreB;
  });
}

function LatencyBadge({ totalMs }: { totalMs: number | null }) {
  if (totalMs == null) return null;
  const color = totalMs < 80 ? "#22c55e" : totalMs < 150 ? "#eab308" : "#ef4444";
  const label = totalMs < 80 ? "низкая задержка" : totalMs < 150 ? "средняя задержка" : "высокая задержка";
  return (
    <span
      title={`~${totalMs} мс задержки (${label})`}
      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      <Wifi className="h-2.5 w-2.5" />
      ~{totalMs} мс
    </span>
  );
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 мин";
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

export default function GameDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const search$ = useSearch();
  const [, navigate] = useLocation();
  const [tag, setTag] = useState<string>("");
  const [preSessionHost, setPreSessionHost] = useState<LibraryHost | null>(null);
  const [previewHost, setPreviewHost] = useState<LibraryHost | null>(null);
  const [selectedBlockMinutes, setSelectedBlockMinutes] = useState<10 | 15 | 25 | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(search$);
    setTag(sp.get("tag")?.trim() ?? "");
  }, [search$]);

  const queryParams = useMemo(() => (tag ? { tag } : {}), [tag]);

  const { data: game, isLoading, isError } = useGetGameBySlug(slug, queryParams, {
    query: {
      enabled: !!slug,
      queryKey: getGetGameBySlugQueryKey(slug, queryParams),
    },
  });

  const { data: libraryHosts, isLoading: hostsLoading } = useLibraryHosts(slug);
  const browserRtt = useBrowserPingMs();
  const { playerWalletToken, registerGuest } = usePlayerWallet();

  async function handlePlayDirect(host: LibraryHost) {
    if (!host.inviteCode) return;
    // Не блокируем навигацию — guest wallet создаётся на /play.
    if (!playerWalletToken) void registerGuest();
    navigate(`/play/i/${host.inviteCode}`);
  }

  function handlePlayConfigure(host: LibraryHost) {
    if (!host.inviteCode) return;
    if (!playerWalletToken) void registerGuest();
    setPreSessionHost(host);
  }

  function clearTag() {
    setTag("");
    const sp = new URLSearchParams(window.location.search);
    sp.delete("tag");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
  }

  const onlineHosts = (libraryHosts ?? []).filter((h) => h.status === "online");
  const offlineHosts = (libraryHosts ?? []).filter((h) => h.status !== "online");

  const sortedLibraryHosts = useMemo(
    () => sortHostsByLatency(libraryHosts ?? [], browserRtt),
    [libraryHosts, browserRtt],
  );

  const filteredLibraryHosts = tag
    ? sortedLibraryHosts.filter((h) =>
        h.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
      )
    : sortedLibraryHosts;

  const totalHostCount = (libraryHosts ?? []).length;

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/games" />

      {preSessionHost && (
        <PreSessionModal
          host={preSessionHost}
          onClose={() => {
            setPreSessionHost(null);
            setSelectedBlockMinutes(null);
          }}
          onConfirm={(blockMins) => {
            if (preSessionHost.inviteCode) {
              setSelectedBlockMinutes(blockMins ?? null);
              const qs = blockMins ? `?block=${blockMins}` : "";
              navigate(`/play/i/${preSessionHost.inviteCode}${qs}`);
            }
          }}
        />
      )}

      {previewHost && (
        <PreviewModal
          host={previewHost}
          onClose={() => setPreviewHost(null)}
          onPlay={() => {
            setPreviewHost(null);
            void handlePlayDirect(previewHost);
          }}
        />
      )}

      <main className="max-w-4xl mx-auto px-6 pt-8 pb-16">
        <Link href="/games">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-400 transition-colors cursor-pointer mb-6">
            <ArrowLeft className="h-3.5 w-3.5" />
            К библиотеке
          </span>
        </Link>

        {isLoading ? (
          <div
            className="h-72 rounded-xl animate-pulse"
            style={{ background: "#0a1018" }}
          />
        ) : isError || !game ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{ background: "#0a1018", border: "1px dashed rgba(255,255,255,0.08)" }}
          >
            <Gamepad2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-medium">Игра не найдена</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-8 mb-10">
              <div
                className="w-full md:w-56 flex-shrink-0 aspect-[3/4] rounded-xl overflow-hidden"
                style={{
                  background: "#0a1018",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {game.coverImageUrl ? (
                  <img
                    src={
                      game.coverImageUrl.startsWith("http")
                        ? game.coverImageUrl
                        : `${import.meta.env.BASE_URL}${game.coverImageUrl.replace(/^\//, "")}`
                    }
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gamepad2 className="h-16 w-16 text-slate-700" />
                  </div>
                )}
              </div>

              <div className="flex-1 pt-1">
                <h1
                  className="text-3xl font-extrabold text-white tracking-tight"
                  data-testid="text-game-title"
                >
                  {game.title}
                </h1>
                {game.genre && (
                  <p className="text-sky-400 font-mono mt-1 text-sm">{game.genre}</p>
                )}
                {(game as GameEnriched).steamAppId && (
                  <SteamPlayerCount steamAppId={(game as GameEnriched).steamAppId!} />
                )}
                <p className="text-slate-400 mt-4 leading-relaxed text-sm">
                  {game.description || "Описание ещё не добавлено."}
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                  {game.isMultiplayer && (
                    <span className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1" style={chip(false)}>
                      <Users className="h-3 w-3" /> Мультиплеер
                    </span>
                  )}
                  {game.hasMods && (
                    <span className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1" style={chip(false)}>
                      <Wand2 className="h-3 w-3" /> Моды
                    </span>
                  )}
                  {game.hostSpectatesPlayer && (
                    <span className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1" style={chip(false)}>
                      <Eye className="h-3 w-3" /> Хост наблюдает
                    </span>
                  )}
                  {game.hasQuests && (
                    <span className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1" style={chip(false)}>
                      <Trophy className="h-3 w-3" /> Квесты
                    </span>
                  )}
                </div>

                {(libraryHosts ?? []).length > 0 && (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <div
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.15)" }}
                    >
                      <span className="text-slate-500 font-normal text-xs mr-1.5">от</span>
                      <span className="text-sky-300">
                        {Math.min(...(libraryHosts ?? []).map((h) => h.pricePerMinuteLzt))} LZT
                      </span>
                      <span className="text-slate-500 font-normal text-xs ml-1">/мин</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {onlineHosts.length > 0 ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          {onlineHosts.length} хост{onlineHosts.length === 1 ? "" : "а"} онлайн
                        </span>
                      ) : (
                        <span className="text-slate-600">{totalHostCount} хост{totalHostCount === 1 ? "" : "а"} в библиотеке</span>
                      )}
                    </div>
                    {onlineHosts[0]?.inviteCode && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Button
                          size="sm"
                          className="h-9 px-4 text-xs font-semibold"
                          style={{ background: "#0ea5e9", color: "#fff" }}
                          onClick={() => void handlePlayDirect(onlineHosts[0])}
                          data-testid="button-play-now-hero"
                        >
                          Играть сейчас
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 px-3 text-xs border-white/15 text-slate-400"
                          onClick={() => handlePlayConfigure(onlineHosts[0])}
                          data-testid="button-configure-session-hero"
                        >
                          Настроить сессию
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <section>
              <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2 flex-wrap text-white">
                <Activity className="h-5 w-5 text-sky-400" />
                Хосты для этой игры
                {hostsLoading ? (
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                    …
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                    {filteredLibraryHosts.length}
                  </span>
                )}
                {tag && (
                  <span
                    className="text-xs px-2 py-0.5 rounded gap-1 cursor-pointer inline-flex items-center"
                    style={chip(true)}
                    onClick={clearTag}
                    data-testid="badge-active-tag"
                    title="Кликни, чтобы снять фильтр"
                  >
                    тег: {tag} <X className="h-3 w-3" />
                  </span>
                )}
              </h2>

              {hostsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-20 rounded-lg animate-pulse"
                      style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.04)" }}
                    />
                  ))}
                </div>
              ) : filteredLibraryHosts.length > 0 ? (
                <ul className="space-y-3" data-testid="list-live-sessions">
                  {filteredLibraryHosts.map((h) => (
                    <LibraryHostRow
                      key={h.hostId}
                      host={h}
                      browserRtt={browserRtt}
                      onPlay={() => void handlePlayDirect(h)}
                      onConfigure={() => handlePlayConfigure(h)}
                      onPreview={() => setPreviewHost(h)}
                    />
                  ))}
                </ul>
              ) : (
                <div
                  className="text-center py-14 rounded-xl"
                  style={{ background: "#0a1018", border: "1px dashed rgba(255,255,255,0.08)" }}
                >
                  <Server className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium">
                    {tag ? "По этому тегу хостов нет." : "Сейчас никто не хостит эту игру."}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Загляни позже — или{" "}
                    <Link href="/host">
                      <span className="text-sky-400 hover:underline cursor-pointer">стань хостом сам</span>
                    </Link>
                    .
                  </p>
                  <GameNotifyButton slug={slug} title={game?.title ?? slug} />
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function LibraryHostRow({
  host: h,
  browserRtt,
  onPlay,
  onConfigure,
  onPreview,
}: {
  host: LibraryHost;
  browserRtt: number | null;
  onPlay: () => void;
  onConfigure: () => void;
  onPreview: () => void;
}) {
  const isOnline = h.status === "online";
  const isAvailable = h.status === "available";

  const lztPerHour = h.pricePerMinuteLzt * 60;
  const usdPerHour = (h.pricePerMinuteUsd * 60).toFixed(2);
  const totalLatency = h.pingMs != null ? Math.round((browserRtt ?? 0) + h.pingMs) : null;
  const isTop = h.hostTier === "above_rec";

  return (
    <li
      className="rounded-lg px-4 py-4 transition-colors"
      style={{
        background: isTop
          ? "linear-gradient(180deg, rgba(250,204,21,0.05), rgba(250,204,21,0) 40%), #0a1018"
          : "#0a1018",
        border: `1px solid ${isTop ? "rgba(250,204,21,0.35)" : isOnline ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.06)"}`,
      }}
      data-testid={`live-host-${h.hostId}`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: isOnline ? "#2dd4bf" : isAvailable ? "#f59e0b" : "#475569",
                boxShadow: isOnline ? "0 0 6px rgba(45,212,191,0.6)" : "none",
              }}
            />
            <span className="font-semibold text-white truncate">{h.displayName}</span>
            {isTop && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(250,204,21,0.12)",
                  color: "#fde047",
                  border: "1px solid rgba(250,204,21,0.3)",
                }}
                title="ПК мощнее рекомендуемых требований"
              >
                <Star className="h-2.5 w-2.5" fill="currentColor" />
                Рекомендуемый+
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
              style={{
                background: isOnline
                  ? "rgba(45,212,191,0.12)"
                  : isAvailable
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(255,255,255,0.04)",
                color: isOnline ? "#2dd4bf" : isAvailable ? "#f59e0b" : "#64748b",
                border: `1px solid ${isOnline ? "rgba(45,212,191,0.2)" : isAvailable ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {isOnline ? "онлайн" : isAvailable ? "доступен" : "по расписанию"}
            </span>
            <LatencyBadge totalMs={totalLatency} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
            <span className="flex items-center gap-1" data-testid={`text-minute-price-${h.hostId}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
              <span className="font-bold text-white">{h.pricePerMinuteLzt} LZT</span>
              <span className="text-slate-500">/мин</span>
              <span className="text-slate-600 font-mono ml-1">≈ ${h.pricePerMinuteUsd.toFixed(4)}</span>
            </span>
            <span className="flex items-center gap-1 text-slate-600 font-mono">
              <Zap className="h-3 w-3" />
              {lztPerHour} LZT/час · ${usdPerHour}/час
            </span>
          </div>

          {h.description && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">{h.description}</p>
          )}

          {h.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {h.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(14,165,233,0.08)", color: "#7dd3fc", border: "1px solid rgba(14,165,233,0.15)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {!isOnline && h.scheduleMode === "scheduled" && (
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-600">
              <Calendar className="h-3 w-3" />
              Хост работает по расписанию
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOnline && (
            <button
              className="h-9 px-3 text-xs font-semibold rounded-md transition-colors"
              style={{
                background: "rgba(14,165,233,0.08)",
                color: "#7dd3fc",
                border: "1px solid rgba(14,165,233,0.18)",
              }}
              data-testid={`button-preview-${h.hostId}`}
              onClick={onPreview}
              title="Бесплатный 30-секундный просмотр экрана хоста"
            >
              <Play className="h-3 w-3 inline mr-1" />
              Превью
            </button>
          )}
          {isOnline && h.inviteCode ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-9 px-5 text-xs font-semibold rounded-md"
                style={{ background: "#0ea5e9", color: "#fff" }}
                data-testid={`button-join-${h.hostId}`}
                onClick={onPlay}
              >
                Играть
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              <button
                type="button"
                className="h-9 px-3 text-[11px] font-medium rounded-md text-slate-500 hover:text-sky-400 transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                onClick={onConfigure}
                title="Выбрать блок минут и проверить пинг"
                data-testid={`button-configure-${h.hostId}`}
              >
                Настроить
              </button>
            </div>
          ) : (
            <button
              disabled
              className="h-9 px-5 text-xs font-semibold rounded-md cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "#475569",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              title="Хост сейчас не в сети"
            >
              Не онлайн
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PreviewModal — 30-second free muted live stream from the host
// ─────────────────────────────────────────────────────────────────────────────

const PREVIEW_DURATION_S = 30;

function PreviewModal({
  host,
  onClose,
  onPlay,
}: {
  host: LibraryHost;
  onClose: () => void;
  onPlay: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStreamedRef = useRef(false);

  const [phase, setPhase] = useState<"connecting" | "streaming" | "ended" | "error">("connecting");
  const [countdown, setCountdown] = useState(PREVIEW_DURATION_S);
  const [errorMsg, setErrorMsg] = useState("");

  const startCountdown = useCallback(() => {
    if (countdownRef.current) return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setPhase("ended");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const cleanup = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    try { pcRef.current?.close(); } catch { /* */ }
    pcRef.current = null;
    try { wsRef.current?.close(); } catch { /* */ }
    wsRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

      // 1. Mint preview token
      let previewToken: string;
      try {
        const res = await fetch(`${base}/api/public/preview-session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hostId: host.hostId }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setErrorMsg(err.error === "host_offline" ? "Хост сейчас не в сети" : "Не удалось запустить превью");
            setPhase("error");
          }
          return;
        }
        const data = (await res.json()) as { previewToken: string };
        previewToken = data.previewToken;
      } catch {
        if (!cancelled) { setErrorMsg("Ошибка сети"); setPhase("error"); }
        return;
      }

      if (cancelled) return;

      // 2. Fetch ICE config
      let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      try {
        const cfgRes = await fetch(`${base}/api/public/ice-config`);
        if (cfgRes.ok) {
          const cfgJson = (await cfgRes.json()) as { iceServers: RTCIceServer[] };
          if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
            iceServers = cfgJson.iceServers;
          }
        }
      } catch { /* use default */ }

      if (cancelled) return;

      // 3. Connect preview WS
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProto}//${window.location.host}${base}/api/signal?type=preview&previewToken=${previewToken}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 4. Create recvonly RTCPeerConnection
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.onicecandidate = (e) => {
        if (e.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ice-candidate", candidate: e.candidate.toJSON() }));
        }
      };

      pc.ontrack = (e) => {
        if (cancelled) return;
        hasStreamedRef.current = true;
        const stream = e.streams[0];
        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => { /* autoplay may be blocked */ });
        }
        setPhase("streaming");
        startCountdown();
      };

      ws.onmessage = async (ev) => {
        if (cancelled) return;
        let msg: { type: string; [k: string]: unknown };
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch { return; }

        if (msg.type === "offer") {
          const sdp = msg["sdp"] as RTCSessionDescriptionInit | string;
          const desc: RTCSessionDescriptionInit = typeof sdp === "string" ? { type: "offer", sdp } : sdp;
          await pc.setRemoteDescription(desc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp } }));
        } else if (msg.type === "ice-candidate") {
          try {
            await pc.addIceCandidate(msg["candidate"] as RTCIceCandidateInit);
          } catch { /* ignore */ }
        } else if (msg.type === "preview-ended" || msg.type === "peer-left") {
          if (!cancelled) setPhase("ended");
        }
      };

      ws.onclose = () => {
        if (!cancelled) setPhase((p) => (p === "ended" ? p : "ended"));
      };

      // Timeout: if no video track arrives within 12s, show error
      setTimeout(() => {
        if (!cancelled && !hasStreamedRef.current) {
          setErrorMsg("Хост не ответил — попробуй позже");
          setPhase("error");
        }
      }, 12_000);
    }

    void start();
    return () => {
      cancelled = true;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    cleanup();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#06090e", border: "1px solid rgba(14,165,233,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(45,212,191,0.6)" }} />
            <span className="font-semibold text-white text-sm">{host.displayName}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
              style={{ background: "rgba(14,165,233,0.1)", color: "#7dd3fc", border: "1px solid rgba(14,165,233,0.2)" }}
            >
              Превью · 30 сек · бесплатно
            </span>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video area */}
        <div
          className="relative w-full"
          style={{ aspectRatio: "16/9", background: "#020508" }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-contain"
            style={{ display: phase === "streaming" || phase === "ended" ? "block" : "none" }}
          />

          {phase === "connecting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
              <p className="text-slate-400 text-sm">Подключаемся к хосту…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                <X className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-slate-400 text-sm">{errorMsg || "Ошибка подключения"}</p>
            </div>
          )}

          {/* Countdown overlay while streaming */}
          {phase === "streaming" && (
            <div
              className="absolute top-3 right-3 text-xs font-mono font-bold px-2 py-1 rounded"
              style={{ background: "rgba(0,0,0,0.6)", color: countdown <= 10 ? "#ef4444" : "#7dd3fc", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {countdown}с
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4">
          {phase === "ended" ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Впечатлило?</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Играй за{" "}
                  <span className="text-sky-300 font-mono font-bold">{host.pricePerMinuteLzt} LZT/мин</span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="h-9 px-4 text-xs font-semibold rounded-md transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}
                  onClick={handleClose}
                >
                  Закрыть
                </button>
                {host.inviteCode && (
                  <Button
                    size="sm"
                    className="h-9 px-5 text-xs font-semibold rounded-md"
                    style={{ background: "#0ea5e9", color: "#fff" }}
                    onClick={() => { cleanup(); onPlay(); }}
                  >
                    Играть
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 text-center">
              {phase === "connecting" ? "Ждём поток от хоста…" : "Просмотр без звука и управления. Биллинг не идёт."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PreSessionModal({
  host,
  onClose,
  onConfirm,
}: {
  host: LibraryHost;
  onClose: () => void;
  onConfirm: (blockMinutes?: 10 | 15 | 25) => void;
}) {
  const { playerWalletToken } = usePlayerWallet();
  const { data: wallet } = useGetWallet(playerWalletToken || "", {
    query: {
      enabled: !!playerWalletToken,
      queryKey: getGetWalletQueryKey(playerWalletToken || ""),
    },
  });

  const [pingMs, setPingMs] = useState<number | null>(null);
  const [pinging, setPinging] = useState(true);
  const didPing = useRef(false);
  const [blockChoice, setBlockChoice] = useState<"unlimited" | "10" | "15" | "25">("unlimited");

  useEffect(() => {
    if (didPing.current) return;
    didPing.current = true;
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const t0 = performance.now();
    fetch(`${base}/api/public/ping`, { method: "GET", cache: "no-store" })
      .then(() => {
        setPingMs(Math.round(performance.now() - t0));
      })
      .catch(() => {
        setPingMs(null);
      })
      .finally(() => setPinging(false));
  }, []);

  const balanceLzt = (wallet?.internalBalanceLzt ?? 0) + (wallet?.withdrawableBalanceLzt ?? 0);
  // Claim не принимает кредитный лимит — показываем только реальные бакеты.
  const totalAvailableLzt = balanceLzt;
  const creditLimit = (wallet as { creditLimitLzt?: number } | undefined)?.creditLimitLzt ?? DEFAULT_CREDIT_LZT;
  const creditUsed = wallet?.creditDebtLzt ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const minsAvailable = host.pricePerMinuteLzt > 0
    ? Math.floor(totalAvailableLzt / host.pricePerMinuteLzt)
    : 9999;

  const blockOptions: Array<{ mins: 10 | 15 | 25; label: string }> = [
    { mins: 10, label: "10 мин" },
    { mins: 15, label: "15 мин" },
    { mins: 25, label: "25 мин" },
  ];
  const selectedBlockMins = blockChoice === "unlimited" ? null : (Number(blockChoice) as 10 | 15 | 25);
  const blockCost = selectedBlockMins ? selectedBlockMins * host.pricePerMinuteLzt : null;
  const canAffordBlock = blockCost === null || totalAvailableLzt >= blockCost;
  const canStart = minsAvailable >= 1 && canAffordBlock;

  const pingColor =
    pingMs === null ? "#64748b"
    : pingMs < 60 ? "#2dd4bf"
    : pingMs < 120 ? "#eab308"
    : "#ef4444";

  const pingLabel =
    pingMs === null ? "нет данных"
    : pingMs < 60 ? "отлично"
    : pingMs < 120 ? "нормально"
    : "высокий";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 mb-4 md:mb-0 rounded-2xl overflow-hidden"
        style={{ background: "#0a1018", border: "1px solid rgba(14,165,233,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-0.5">Хост</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400" style={{ boxShadow: "0 0 6px rgba(45,212,191,0.6)" }} />
              <span className="font-bold text-white text-base">{host.displayName}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Пинг
              </p>
              {pinging ? (
                <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />
              ) : (
                <>
                  <p className="text-lg font-bold font-mono" style={{ color: pingColor }}>
                    {pingMs !== null ? `${pingMs} мс` : "—"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: pingColor, opacity: 0.75 }}>
                    {pingLabel}
                  </p>
                </>
              )}
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Стоимость
              </p>
              <p className="text-lg font-bold font-mono text-white">
                {host.pricePerMinuteLzt} LZT
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                в минуту · {host.pricePerMinuteLzt * 60} LZT/час
              </p>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.12)" }}
          >
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Доступно для игры</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                  Игровой баланс
                </span>
                <span className="font-mono text-white">{(wallet?.internalBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  К выводу
                </span>
                <span className="font-mono text-white">{(wallet?.withdrawableBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT</span>
              </div>
              {creditAvailable > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Кредит (не для claim)</span>
                  <span className="font-mono text-slate-500">+{creditAvailable.toLocaleString("ru-RU")} LZT</span>
                </div>
              )}
              <div
                className="flex justify-between items-center pt-1.5 border-t"
                style={{ borderColor: "rgba(14,165,233,0.15)" }}
              >
                <span className="text-slate-300 font-medium">Для старта сессии</span>
                <span className="font-mono font-bold text-sky-300">{totalAvailableLzt.toLocaleString("ru-RU")} LZT</span>
              </div>
            </div>
          </div>

          {/* Block selector (only shown for paid sessions) */}
          {host.pricePerMinuteLzt > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Блок времени
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  className="rounded-lg py-2 text-xs font-medium transition-all"
                  style={blockChoice === "unlimited"
                    ? { background: "#0ea5e9", color: "#fff", border: "1px solid #0ea5e9" }
                    : { background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}
                  onClick={() => setBlockChoice("unlimited")}
                >
                  ∞
                </button>
                {blockOptions.map((opt) => {
                  const cost = opt.mins * host.pricePerMinuteLzt;
                  const affordable = totalAvailableLzt >= cost;
                  return (
                    <button
                      key={opt.mins}
                      className="rounded-lg py-1.5 text-xs font-medium transition-all"
                      style={blockChoice === String(opt.mins)
                        ? { background: "#0ea5e9", color: "#fff", border: "1px solid #0ea5e9" }
                        : !affordable
                          ? { background: "transparent", color: "#475569", border: "1px solid rgba(255,255,255,0.04)", cursor: "not-allowed" }
                          : { background: "transparent", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)" }}
                      onClick={() => affordable && setBlockChoice(String(opt.mins) as "10" | "15" | "25")}
                      disabled={!affordable}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[9px] opacity-70">{cost.toLocaleString("ru-RU")} LZT</div>
                    </button>
                  );
                })}
              </div>
              {blockCost !== null && (
                <p className="text-[10px] text-slate-500 mt-2">
                  Стоимость блока: <span className="text-sky-400 font-mono">{blockCost.toLocaleString("ru-RU")} LZT</span> — резервируется заранее, остаток возвращается.
                </p>
              )}
            </div>
          )}

          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{
              background: minsAvailable >= 30
                ? "rgba(45,212,191,0.07)"
                : minsAvailable >= 5
                ? "rgba(234,179,8,0.07)"
                : "rgba(239,68,68,0.07)",
              border: `1px solid ${minsAvailable >= 30 ? "rgba(45,212,191,0.2)" : minsAvailable >= 5 ? "rgba(234,179,8,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}
          >
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Сможешь играть</p>
              <p
                className="text-2xl font-extrabold font-mono mt-0.5"
                style={{
                  color: minsAvailable >= 30 ? "#2dd4bf" : minsAvailable >= 5 ? "#eab308" : "#ef4444",
                }}
              >
                {minsAvailable >= 9999 ? "∞" : formatDuration(minsAvailable)}
              </p>
            </div>
            {minsAvailable < 5 && (
              <Link href="/wallet">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-white/10 text-slate-300"
                  onClick={onClose}
                >
                  Пополнить
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button
            className="w-full h-11 font-bold text-sm rounded-xl"
            style={{ background: canStart ? "#0ea5e9" : "#1e293b", color: canStart ? "#fff" : "#64748b" }}
            onClick={() => onConfirm(selectedBlockMins ?? undefined)}
            disabled={!canStart}
          >
            {!canStart
              ? (!canAffordBlock ? "Недостаточно для блока" : "Недостаточно баланса")
              : blockCost !== null
                ? `Зарезервировать ${blockCost.toLocaleString("ru-RU")} LZT и начать`
                : "Начать игру"}
            {canStart && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
