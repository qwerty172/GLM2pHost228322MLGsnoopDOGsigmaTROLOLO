import { Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp, Cpu, Gamepad2, X } from "lucide-react";
import { useState } from "react";
import {
  useListPublicHosts,
  getListPublicHostsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
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
                title={`${g.title} · 🔵 ${g.pricePerMinuteLzt} LZT/мин`}
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
                <span className="text-blue-500 flex-shrink-0">🔵{g.pricePerMinuteLzt}</span>
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

// Resolve session playerToken for a specific host+game combo via public API.
// Returns null if the host has no active session for this game (not online).
async function resolvePlayerToken(
  hostId: string,
  gameSlug: string,
): Promise<string | null> {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
  const resp = await fetch(
    `${base}/api/public/games/${encodeURIComponent(gameSlug)}/hosts`,
  );
  if (!resp.ok) return null;
  const list: Array<{ hostId: string; playerToken: string | null }> =
    await resp.json();
  return list.find((h) => h.hostId === hostId)?.playerToken ?? null;
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
                    🔵 {g.pricePerMinuteLzt} LZT/мин
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
  fallbackPlayerToken,
}: {
  hostId: string;
  games: LibraryGame[];
  fallbackPlayerToken: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  // Connect to the host for a specific game.
  // Tries to resolve an active session playerToken from the public API;
  // if found, goes directly to /play/:playerToken.
  // If not, falls back to the game detail page so the player can try again.
  const connectToGame = async (game: LibraryGame) => {
    setLoading(true);
    try {
      const playerToken = await resolvePlayerToken(hostId, game.slug);
      if (playerToken) {
        navigate(`/play/${playerToken}`);
      } else {
        // Host has no active session for this game — send to game page
        // so the user can wait or pick another host.
        navigate(`/games/${game.slug}`);
      }
    } catch {
      navigate(`/games/${game.slug}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async () => {
    if (games.length === 0) {
      navigate(`/play/${fallbackPlayerToken}`);
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
  const { data: hosts, isLoading } = useListPublicHosts({
    query: {
      queryKey: getListPublicHostsQueryKey(),
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  });

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
          <div className="text-xs text-slate-500">
            Всего:{" "}
            <span className="text-sky-400 font-semibold" data-testid="text-host-count">
              {hosts?.length ?? 0}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg surface-card animate-pulse" />
            ))}
          </div>
        ) : !hosts || hosts.length === 0 ? (
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
            {hosts.map((h) => {
              const games = ((h as any).games ?? []) as LibraryGame[];
              const isOnline = h.status === "online";

              return (
                <div
                  key={h.id}
                  className="host-row p-4"
                  data-testid={`host-row-${h.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{
                            background: isOnline ? "#2dd4bf" : "#64748b",
                            boxShadow: isOnline ? "0 0 6px rgba(45,212,191,0.7)" : "none",
                          }}
                        />
                        <span className="font-semibold text-white truncate">
                          {h.displayName}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                          {isOnline ? "онлайн" : "по расписанию"}
                        </span>
                      </div>

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
                            🔵 {Math.min(...games.map((g) => g.pricePerMinuteLzt))}+ LZT/мин
                          </div>
                        )}
                      </div>

                      <PlayButton
                        hostId={h.id}
                        games={games}
                        fallbackPlayerToken={h.playerToken}
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
