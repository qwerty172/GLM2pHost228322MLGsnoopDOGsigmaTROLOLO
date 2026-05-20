import { Link } from "wouter";
import { ChevronDown, ChevronUp, Cpu, Gamepad2 } from "lucide-react";
import { useState } from "react";
import {
  useListPublicHosts,
  getListPublicHostsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";

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

function GameChips({ games, playerToken }: { games: LibraryGame[]; playerToken: string }) {
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
          const cover = g.coverImageUrl
            ? g.coverImageUrl.startsWith("http")
              ? g.coverImageUrl
              : `${import.meta.env.BASE_URL}${g.coverImageUrl.replace(/^\//, "")}`
            : null;
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
                {cover ? (
                  <img
                    src={cover}
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
                        <GameChips games={games} playerToken={h.playerToken} />
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

                      {games.length === 0 ? (
                        <Link href={`/play/${h.playerToken}`}>
                          <button
                            className="h-9 px-4 text-xs font-semibold rounded-md transition-colors"
                            style={{ background: "#0ea5e9", color: "#fff" }}
                            data-testid={`button-join-${h.id}`}
                          >
                            Подключиться
                          </button>
                        </Link>
                      ) : (
                        <Link href={`/play/${h.playerToken}`}>
                          <button
                            className="h-9 px-4 text-xs font-semibold rounded-md transition-colors"
                            style={{ background: "#0ea5e9", color: "#fff" }}
                            data-testid={`button-join-${h.id}`}
                          >
                            Играть
                          </button>
                        </Link>
                      )}
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
