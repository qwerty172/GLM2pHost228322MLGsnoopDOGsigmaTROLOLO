import { Link, useParams, useSearch, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Bell,
  Calendar,
  Clock,
  Eye,
  Gamepad2,
  Layers,
  Loader2,
  Server,
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

type LibraryHost = {
  hostId: string;
  displayName: string;
  tags: string[];
  description: string | null;
  pricePerMinuteLzt: number;
  pricePerMinuteUsd: number;
  status: "online" | "available" | "scheduled";
  playerToken: string | null;
  scheduleMode: string;
  pingMs: number | null;
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
  return [...hosts].sort((a, b) => {
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

  const filteredLiveSessions = tag
    ? (game?.liveSessions ?? []).filter((s) =>
        s.tags?.some((t: string) => t.toLowerCase() === tag.toLowerCase()),
      )
    : (game?.liveSessions ?? []);

  const totalHostCount = (libraryHosts ?? []).length || (game?.liveSessions ?? []).length;

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/games" />

      {preSessionHost && (
        <PreSessionModal
          host={preSessionHost}
          onClose={() => setPreSessionHost(null)}
          onConfirm={() => {
            if (preSessionHost.playerToken) {
              navigate(`/play/${preSessionHost.playerToken}`);
            }
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
                  <div className="mt-6 flex items-center gap-3">
                    <div
                      className="px-3 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.15)" }}
                    >
                      <span className="text-slate-500 font-normal text-xs mr-1.5">от</span>
                      <span className="text-sky-300">
                        🔵 {Math.min(...(libraryHosts ?? []).map((h) => h.pricePerMinuteLzt))} LZT
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
                    {filteredLibraryHosts.length || filteredLiveSessions.length}
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
                      onPlay={() => setPreSessionHost(h)}
                    />
                  ))}
                </ul>
              ) : filteredLiveSessions.length > 0 ? (
                <ul className="space-y-3" data-testid="list-live-sessions">
                  {filteredLiveSessions.map((s: any) => (
                    <LegacySessionRow key={s.playerToken} session={s} />
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
                    onClick={() => {}}
                    title="Скоро"
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

function LibraryHostRow({ host: h, browserRtt, onPlay }: { host: LibraryHost; browserRtt: number | null; onPlay: () => void }) {
  const isOnline = h.status === "online";
  const isAvailable = h.status === "available";

  const lztPerHour = h.pricePerMinuteLzt * 60;
  const usdPerHour = (h.pricePerMinuteUsd * 60).toFixed(2);
  const totalLatency = h.pingMs != null ? Math.round((browserRtt ?? 0) + h.pingMs) : null;

  return (
    <li
      className="rounded-lg px-4 py-4 transition-colors"
      style={{
        background: "#0a1018",
        border: `1px solid ${isOnline ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.06)"}`,
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
              <span className="text-blue-400">🔵</span>
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

        <div className="flex items-center gap-3 shrink-0">
          {isOnline && h.playerToken ? (
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

function LegacySessionRow({ session: s }: { session: any }) {
  return (
    <li
      className="rounded-lg px-4 py-4 transition-colors"
      style={{ background: "#0a1018", border: "1px solid rgba(14,165,233,0.15)" }}
      data-testid={`live-host-${s.playerToken}`}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-teal-400" style={{ boxShadow: "0 0 6px rgba(45,212,191,0.6)" }} />
            <span className="font-semibold text-white truncate">{s.hostDisplayName}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
              style={{ background: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.2)" }}
            >
              онлайн
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
            {s.pricePerMinuteLzt > 0 ? (
              <span className="flex items-center gap-1">
                <span className="text-blue-400">🔵</span>
                <span className="font-bold text-white">{s.pricePerMinuteLzt} LZT</span>
                <span className="text-slate-500">/мин</span>
                <span className="text-slate-600 font-mono ml-1">
                  ≈ ${(s.pricePerMinuteLzt / LZT_PER_USD).toFixed(4)}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-400" />
                <span className="text-slate-500">за минуту:</span>
                <span className="font-semibold text-white">
                  ${s.minutePriceUsd < 0 ? "−" : ""}${Math.abs(s.minutePriceUsd).toFixed(4)}
                </span>
              </span>
            )}
            {s.resolution && (
              <span className="text-slate-600 font-mono">
                {s.resolution} · {s.bitrateKbps} kbps
              </span>
            )}
          </div>

          {s.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {s.tags.map((t: string) => (
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
        </div>

        <Link href={`/play/${s.playerToken}`} className="shrink-0">
          <Button
            size="sm"
            className="h-9 px-5 text-xs font-semibold rounded-md"
            style={{ background: "#0ea5e9", color: "#fff" }}
            data-testid={`button-join-${s.playerToken}`}
          >
            Играть
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </li>
  );
}

function PreSessionModal({
  host,
  onClose,
  onConfirm,
}: {
  host: LibraryHost;
  onClose: () => void;
  onConfirm: () => void;
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

  useEffect(() => {
    if (didPing.current) return;
    didPing.current = true;
    const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
    const t0 = performance.now();
    fetch(`${base}/api/public/stats`, { method: "GET", cache: "no-store" })
      .then(() => {
        setPingMs(Math.round(performance.now() - t0));
      })
      .catch(() => {
        setPingMs(null);
      })
      .finally(() => setPinging(false));
  }, []);

  const balanceLzt = (wallet?.internalBalanceLzt ?? 0) + (wallet?.withdrawableBalanceLzt ?? 0);
  const creditLimit = (wallet as any)?.creditLimitLzt ?? DEFAULT_CREDIT_LZT;
  const creditUsed = wallet?.creditDebtLzt ?? 0;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);
  const totalAvailableLzt = balanceLzt + creditAvailable;
  const minsAvailable = host.pricePerMinuteLzt > 0
    ? Math.floor(totalAvailableLzt / host.pricePerMinuteLzt)
    : 9999;

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
                <span className="text-slate-400">🔵 Синий баланс</span>
                <span className="font-mono text-white">{(wallet?.internalBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">🟢 Зелёный баланс</span>
                <span className="font-mono text-white">{(wallet?.withdrawableBalanceLzt ?? 0).toLocaleString("ru-RU")} LZT</span>
              </div>
              {creditAvailable > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">💳 Кредитный лимит</span>
                  <span className="font-mono text-amber-400">+{creditAvailable.toLocaleString("ru-RU")} LZT</span>
                </div>
              )}
              <div
                className="flex justify-between items-center pt-1.5 border-t"
                style={{ borderColor: "rgba(14,165,233,0.15)" }}
              >
                <span className="text-slate-300 font-medium">Итого</span>
                <span className="font-mono font-bold text-sky-300">{totalAvailableLzt.toLocaleString("ru-RU")} LZT</span>
              </div>
            </div>
          </div>

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
            style={{ background: "#0ea5e9", color: "#fff" }}
            onClick={onConfirm}
            disabled={minsAvailable < 1}
          >
            {minsAvailable < 1 ? "Недостаточно баланса" : "Начать игру"}
            {minsAvailable >= 1 && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
