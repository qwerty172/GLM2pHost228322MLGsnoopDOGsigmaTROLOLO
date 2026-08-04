import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp, Cpu, Gamepad2, MemoryStick, Monitor, Star, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useListPublicHosts,
  getListPublicHostsQueryKey,
  createPublicSession,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { GuestCreditHint } from "@/components/guest-credit-hint";
import { useBrowserPingMs } from "@/hooks/use-browser-ping";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LibraryGame = {
  gameId: string;
  slug: string;
  title: string;
  coverImageUrl: string;
  genre: string;
  pricePerMinuteLzt: number;
};

function LatencyBadge({ totalMs }: { totalMs: number | null }) {
  if (totalMs == null) return null;
  const color = totalMs < 80 ? "#22c55e" : totalMs < 150 ? "#eab308" : "#ef4444";
  return (
    <span
      title={`~${totalMs} мс задержки`}
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      <Wifi className="h-2.5 w-2.5" />
      ~{totalMs} мс
    </span>
  );
}

function formatPrice(usd: number): string {
  const sign = usd < 0 ? "−" : "";
  return `${sign}$${Math.abs(usd).toFixed(2)}`;
}

function coverSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
}

function GameChips({ games }: { games: LibraryGame[] }) {
  const [expanded, setExpanded] = useState(false);
  const SHOW = 3;
  const visible = expanded ? games : games.slice(0, SHOW);
  const extra = games.length - SHOW;

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-1.5 font-mono">
        Игры в библиотеке
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((g) => {
          const src = coverSrc(g.coverImageUrl);
          return (
            <Link key={g.gameId} href={`/games/${g.slug}`}>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md cursor-pointer transition-colors"
                style={{
                  background: "rgba(14,165,233,0.06)",
                  border: "1px solid rgba(14,165,233,0.12)",
                  color: "#7dd3fc",
                }}
                title={`${g.title} · ${g.pricePerMinuteLzt} LZT/мин`}
                data-testid={`game-chip-${g.slug}`}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    className="w-4 h-4 rounded object-cover flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <Gamepad2 className="h-3 w-3 flex-shrink-0 text-slate-600" />
                )}
                <span className="max-w-[120px] truncate">{g.title}</span>
                <span className="text-blue-500 flex-shrink-0">{g.pricePerMinuteLzt}</span>
              </span>
            </Link>
          );
        })}

        {!expanded && extra > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#64748b",
            }}
          >
            +{extra} ещё
            <ChevronDown className="h-3 w-3" />
          </button>
        )}

        {expanded && games.length > SHOW && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#64748b",
            }}
          >
            Свернуть
            <ChevronUp className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

type SessionResult =
  | { ok: true; inviteCode: string }
  | { ok: false; reason: "game_unavailable" | "host_offline" | "error" };

// POST /api/public/sessions { hostId, gameId? }
// Returns inviteCode for /play/i/:inviteCode (raw playerToken is not public).
async function requestSession(
  hostId: string,
  gameId?: string,
): Promise<SessionResult> {
  try {
    const data = await createPublicSession({
      hostId,
      ...(gameId ? { gameId } : {}),
    });
    if (!data.inviteCode) return { ok: false, reason: "error" };
    return { ok: true, inviteCode: data.inviteCode };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 409) return { ok: false, reason: "game_unavailable" };
    if (status === 503 || status === 404) return { ok: false, reason: "host_offline" };
    return { ok: false, reason: "error" };
  }
}

function GamePickerDialog({
  open,
  games,
  onClose,
  onPick,
}: {
  open: boolean;
  games: LibraryGame[];
  onClose: () => void;
  onPick: (game: LibraryGame) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        style={{ background: "#0d1420", border: "1px solid rgba(14,165,233,0.2)" }}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-bold">Выбери игру</DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Выбери, в какую игру хочешь играть у этого хоста.
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2 max-h-80 overflow-y-auto pr-1">
          {games.map((g) => {
            const src = coverSrc(g.coverImageUrl);
            return (
              <button
                key={g.gameId}
                type="button"
                onClick={() => onPick(g)}
                className="flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(14,165,233,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "rgba(255,255,255,0.07)";
                }}
                data-testid={`picker-game-${g.slug}`}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    className="w-10 h-14 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="w-10 h-14 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(14,165,233,0.08)" }}
                  >
                    <Gamepad2 className="h-5 w-5 text-slate-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white text-sm truncate">
                    {g.title}
                  </div>
                  {g.genre && (
                    <div className="text-[11px] text-sky-400 font-mono">{g.genre}</div>
                  )}
                  <div className="text-[11px] text-blue-400 mt-1 font-mono">
                    {g.pricePerMinuteLzt} LZT/мин
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full h-8 rounded-md text-xs text-slate-500 transition-colors"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          Отмена
        </button>
      </DialogContent>
    </Dialog>
  );
}

function PlayButton({
  hostId,
  games,
  fallbackInviteCode,
}: {
  hostId: string;
  games: LibraryGame[];
  fallbackInviteCode: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  // Connect to the host for a specific game via POST /api/public/sessions.
  // - On success → navigate to /play/i/:inviteCode.
  // - On game_unavailable → toast + fall back to list inviteCode when present.
  // - On host_offline / error → same fallback, else game detail page.
  const connectToGame = async (game: LibraryGame) => {
    setLoading(true);
    try {
      const result = await requestSession(hostId, game.gameId);
      if (result.ok) {
        navigate(`/play/i/${result.inviteCode}`);
        return;
      }
      if (result.reason === "game_unavailable") {
        toast.warning(`Игра «${game.title}» сейчас недоступна у этого хоста`);
      }
      if (fallbackInviteCode) {
        navigate(`/play/i/${fallbackInviteCode}`);
      } else {
        navigate(`/games/${game.slug}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async () => {
    if (games.length === 0) {
      if (fallbackInviteCode) {
        navigate(`/play/i/${fallbackInviteCode}`);
      } else {
        const result = await requestSession(hostId);
        if (result.ok) navigate(`/play/i/${result.inviteCode}`);
        else toast.error("Хост сейчас недоступен");
      }
    } else if (games.length === 1) {
      await connectToGame(games[0]);
    } else {
      setPickerOpen(true);
    }
  };

  const handlePick = async (game: LibraryGame) => {
    setPickerOpen(false);
    await connectToGame(game);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handlePlay()}
        disabled={loading}
        className="h-9 px-4 text-xs font-semibold rounded-md transition-colors disabled:opacity-60"
        style={{ background: "#0ea5e9", color: "#fff" }}
        data-testid={`button-join-${hostId}`}
      >
        {loading ? "…" : games.length === 0 ? "Подключиться" : "Играть"}
      </button>
      {games.length > 1 && (
        <GamePickerDialog
          open={pickerOpen}
          games={games}
          onClose={() => setPickerOpen(false)}
          onPick={(g) => void handlePick(g)}
        />
      )}
    </>
  );
}

export default function HostsPage() {
  const { data: hosts, isLoading, isError, refetch, isFetching } = useListPublicHosts({
    query: {
      queryKey: getListPublicHostsQueryKey(),
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  });

  const browserRtt = useBrowserPingMs();
  const [onlineOnly, setOnlineOnly] = useState(false);

  const sortedHosts = useMemo(() => {
    if (!hosts) return hosts;
    const tierRank = (t: unknown) => (t === "above_rec" ? 0 : 1);
    let list = [...hosts];
    if (onlineOnly) {
      list = list.filter((h) => !!(h as any).isOnline);
    }
    return list.sort((a, b) => {
      // Online hosts first, then recommended-and-above, then by latency.
      const onlineA = (a as any).isOnline ? 0 : 1;
      const onlineB = (b as any).isOnline ? 0 : 1;
      if (onlineA !== onlineB) return onlineA - onlineB;
      const tierDiff = tierRank((a as any).hostTier) - tierRank((b as any).hostTier);
      if (tierDiff !== 0) return tierDiff;
      const pa = (a as any).pingMs as number | null | undefined;
      const pb = (b as any).pingMs as number | null | undefined;
      const scoreA = pa != null ? (browserRtt ?? 0) + pa : Infinity;
      const scoreB = pb != null ? (browserRtt ?? 0) + pb : Infinity;
      return scoreA - scoreB;
    });
  }, [hosts, browserRtt, onlineOnly]);

  return (
    <div
      className="min-h-screen text-slate-300 font-sans"
      style={{ background: "#06090e" }}
    >
      <style>{`
        .surface-card {
          background: #0a1018;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
        }
        .host-row {
          background: #0a1018;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          transition: border-color .15s;
        }
        .host-row:hover { border-color: rgba(14,165,233,0.25); }
        .host-row--top {
          border-color: rgba(250,204,21,0.35);
          background:
            linear-gradient(180deg, rgba(250,204,21,0.05), rgba(250,204,21,0) 40%),
            #0a1018;
        }
        .host-row--top:hover { border-color: rgba(250,204,21,0.55); }
        .tier-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(250,204,21,0.12);
          color: #fde047;
          border: 1px solid rgba(250,204,21,0.3);
          white-space: nowrap;
        }
        .tag-chip {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(14,165,233,0.08);
          color: #7dd3fc;
          border: 1px solid rgba(14,165,233,0.15);
        }
      `}</style>

      <SiteNav activePath="/hosts" />

      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-6 h-6 text-sky-400" /> Хосты онлайн
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Живой список ПК, готовых к подключению прямо сейчас.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                role="switch"
                aria-checked={onlineOnly}
                aria-label="Только онлайн"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
                className="sr-only"
              />
              <div
                className="relative w-9 h-5 rounded-full transition-colors"
                style={{ background: onlineOnly ? "#22c55e" : "rgba(255,255,255,0.1)" }}
                aria-hidden="true"
              >
                <div
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: onlineOnly ? "translateX(16px)" : "translateX(0)" }}
                />
              </div>
              <span className="text-xs text-slate-400">Только онлайн</span>
            </label>
            <div className="text-xs text-slate-500">
              Всего:{" "}
              <span className="text-sky-400 font-semibold" data-testid="text-host-count">
                {sortedHosts?.length ?? hosts?.length ?? 0}
              </span>
            </div>
          </div>
        </div>

        <GuestCreditHint className="mb-6" />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg surface-card animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="surface-card p-12 text-center">
            <Cpu className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">
              Не удалось загрузить список хостов
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Проверьте соединение и попробуйте снова.
            </p>
            <button
              type="button"
              className="mt-4 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? "Загрузка…" : "Повторить"}
            </button>
          </div>
        ) : !sortedHosts || sortedHosts.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <Cpu className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              Сейчас ни один хост не онлайн.
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Загляни позже — или сам стань хостом и заработай на свободном GPU.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="list-public-hosts">
            {sortedHosts.map((h) => {
              const games = ((h as any).games ?? []) as LibraryGame[];
              const isOnline = !!(h as any).isOnline;
              const hostPingMs = (h as any).pingMs as number | null | undefined;
              const totalLatency = hostPingMs != null ? Math.round((browserRtt ?? 0) + hostPingMs) : null;
              const isTop = (h as any).hostTier === "above_rec";
              const pcSpecs = (h as any).pcSpecs as { cpu?: string; gpu?: string; ramGb?: number } | null | undefined;

              return (
                <div
                  key={h.id}
                  className={`host-row p-4${isTop ? " host-row--top" : ""}`}
                  data-testid={`host-row-${h.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: isOnline ? "#22c55e" : "#64748b",
                            boxShadow: isOnline ? "0 0 6px rgba(34,197,94,0.7)" : "none",
                          }}
                        />
                        <span className="font-semibold text-white truncate">
                          {h.displayName}
                        </span>
                        {isOnline && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                          >
                            ● Онлайн
                          </span>
                        )}
                        {isTop && (
                          <span className="tier-badge" title="ПК мощнее рекомендуемых требований">
                            <Star className="h-2.5 w-2.5" fill="currentColor" />
                            Рекомендуемый+
                          </span>
                        )}
                        {!isOnline && (
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                            по расписанию
                          </span>
                        )}
                        <LatencyBadge totalMs={totalLatency} />
                      </div>

                      {pcSpecs && (pcSpecs.gpu || pcSpecs.cpu || pcSpecs.ramGb) && (
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {pcSpecs.gpu && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <Monitor className="h-2.5 w-2.5 text-violet-400" />
                              {pcSpecs.gpu}
                            </span>
                          )}
                          {pcSpecs.cpu && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <Cpu className="h-2.5 w-2.5 text-sky-400" />
                              {pcSpecs.cpu}
                            </span>
                          )}
                          {pcSpecs.ramGb && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                              <MemoryStick className="h-2.5 w-2.5 text-emerald-400" />
                              {pcSpecs.ramGb} GB
                            </span>
                          )}
                        </div>
                      )}

                      {h.tags && h.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {h.tags.map((t) => (
                            <span key={t} className="tag-chip">{t}</span>
                          ))}
                        </div>
                      )}

                      {games.length > 0 && (
                        <GameChips games={games} />
                      )}
                    </div>

                    <div className="flex items-center gap-5 shrink-0 md:pt-1">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">цена / час</div>
                        <div
                          className="text-lg font-bold tracking-tight"
                          style={{ color: h.minutePriceUsd < 0 ? "#34d399" : "#f8fafc" }}
                        >
                          {formatPrice(h.pricePerHourUsd)}
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">
                          {formatPrice(h.minutePriceUsd)}/мин
                        </div>
                        {games.length > 0 && (
                          <div className="text-[10px] text-blue-500 font-mono mt-0.5">
                            {Math.min(...games.map((g) => g.pricePerMinuteLzt))}+ LZT/мин
                          </div>
                        )}
                      </div>

                      <PlayButton
                        hostId={h.id}
                        games={games}
                        fallbackInviteCode={h.inviteCode ?? null}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
