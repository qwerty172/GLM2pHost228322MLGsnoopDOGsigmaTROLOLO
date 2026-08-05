import { Link, useParams, useSearch, useLocation } from "wouter";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatApiError } from "@/lib/api-errors";
import { useBrowserPingMs } from "@/hooks/use-browser-ping";
import {
  useGetGameBySlug,
  getGetGameBySlugQueryKey,
  useSteamLookup,
  useListPublicGameHosts,
  getListPublicGameHostsQueryKey,
  createPreviewSession,
  getPublicIceConfig,
  type PublicGameHostItem,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CircleDollarSign,
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
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import {
  chip,
  CLAIM_BALANCE_NOTE,
  computeMinPriceLzt,
  computeTotalLatency,
  filterHostsByTag,
  formatMinutePriceDetail,
  formatUsdPerMinute,
  getLatencyColor,
  getLatencyLabel,
  LZT_EXPLAINER,
  resolveCoverImageUrl,
  sortHostsByLatency,
} from "@/pages/game-detail-helpers";

type GameEnriched = {
  steamAppId?: string | null;
};

function SteamPlayerCount({ steamAppId }: { steamAppId: string }) {
  const { data } = useSteamLookup({ appId: steamAppId });
  const count = data?.currentPlayers;
  if (count == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 mt-1 font-mono">
      <Activity className="h-3 w-3" />
      {count.toLocaleString("ru-RU")} играют в Steam
    </span>
  );
}

function LatencyBadge({ totalMs }: { totalMs: number | null }) {
  if (totalMs == null) return null;
  const color = getLatencyColor(totalMs);
  const label = getLatencyLabel(totalMs);
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

export default function GameDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const search$ = useSearch();
  const [, navigate] = useLocation();
  const [tag, setTag] = useState<string>("");
  const [previewHost, setPreviewHost] = useState<PublicGameHostItem | null>(null);

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

  const { data: libraryHosts, isLoading: hostsLoading } = useListPublicGameHosts(slug, {
    query: {
      enabled: !!slug,
      queryKey: getListPublicGameHostsQueryKey(slug),
      refetchInterval: 20_000,
      staleTime: 10_000,
    },
  });
  const browserRtt = useBrowserPingMs();
  const { playerWalletToken, registerGuest } = usePlayerWallet();

  async function handlePlayDirect(host: PublicGameHostItem) {
    if (!host.inviteCode) return;
    // Не блокируем навигацию — guest wallet создаётся на /play.
    if (!playerWalletToken) void registerGuest();
    navigate(`/play/i/${host.inviteCode}`);
  }

  function handlePlayConfigure(host: PublicGameHostItem) {
    if (!host.inviteCode) return;
    if (!playerWalletToken) void registerGuest();
    navigate(`/play/i/${host.inviteCode}`);
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

  const filteredLibraryHosts = filterHostsByTag(sortedLibraryHosts, tag);

  const totalHostCount = (libraryHosts ?? []).length;

  const minPriceLzt = useMemo(
    () => computeMinPriceLzt(libraryHosts ?? []),
    [libraryHosts],
  );

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/games" />

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
                    src={resolveCoverImageUrl(game.coverImageUrl, import.meta.env.BASE_URL)}
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

                {(libraryHosts ?? []).length > 0 && minPriceLzt != null && (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <div
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.15)" }}
                      data-testid="badge-hero-minute-price"
                    >
                      <span className="text-slate-500 font-normal text-xs mr-1.5">от</span>
                      <span className="text-sky-300">{minPriceLzt} LZT</span>
                      <span className="text-slate-500 font-normal text-xs ml-1">/мин</span>
                      <span className="text-slate-600 font-mono text-xs ml-1.5">
                        ≈ ${formatUsdPerMinute(minPriceLzt)}
                      </span>
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

            {minPriceLzt != null && (
              <section
                className="mb-8 rounded-xl p-4"
                style={{
                  background: "rgba(14,165,233,0.05)",
                  border: "1px solid rgba(14,165,233,0.12)",
                }}
                data-testid="first-minute-pricing"
              >
                <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-sky-400" />
                  Сколько стоит игра
                </h2>
                <p
                  className="text-sm font-mono text-sky-300"
                  data-testid="text-minute-price-detail"
                >
                  {formatMinutePriceDetail(minPriceLzt)}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{LZT_EXPLAINER}</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{CLAIM_BALANCE_NOTE}</p>
                <Link href="/wallet">
                  <span className="inline-flex items-center gap-1 mt-3 text-xs text-sky-400 hover:underline cursor-pointer">
                    Пополнить баланс
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </section>
            )}

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
                  <button
                    className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#94a3b8",
                    }}
                    onClick={() => toast.success("Готово! Мы покажем эту игру выше в каталоге, когда появится хост.", { duration: 4000 })}
                  >
                    <Bell className="h-3 w-3" />
                    Уведомить когда появится хост
                  </button>
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
  host: PublicGameHostItem;
  browserRtt: number | null;
  onPlay: () => void;
  onConfigure: () => void;
  onPreview: () => void;
}) {
  const isOnline = h.status === "online";
  const isAvailable = h.status === "available";

  const lztPerHour = h.pricePerMinuteLzt * 60;
  const usdPerHour = (h.pricePerMinuteUsd * 60).toFixed(2);
  const totalLatency = computeTotalLatency(browserRtt, h.pingMs);
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

          {(h.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(h.tags ?? []).map((t) => (
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
  host: PublicGameHostItem;
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
        const data = await createPreviewSession({ hostId: host.hostId });
        previewToken = data.previewToken;
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(formatApiError(err, "Не удалось запустить превью"));
          setPhase("error");
        }
        return;
      }

      if (cancelled) return;

      // 2. Fetch ICE config
      let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
      try {
        const cfgJson = await getPublicIceConfig();
        if (Array.isArray(cfgJson.iceServers) && cfgJson.iceServers.length > 0) {
          iceServers = cfgJson.iceServers;
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
  }, [host.hostId, cleanup, startCountdown]);

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
