import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useListGames,
  getListGamesQueryKey,
  useCreateBrowserHostSession,
  type GameListItem,
} from "@workspace/api-client-react";
import { usePlayerWallet } from "@/hooks/use-player-wallet";
import { formatApiError } from "@/lib/api-errors";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Gamepad2,
  Rocket,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import {
  BROWSER_HOST_URL_STORAGE_PREFIX,
  HOST_TOKEN_STORAGE_PREFIX,
  buildGamesApiParams,
  computeGlobalMaxLzt,
  extractAllGenres,
  extractCategories,
  filterAndSortGames,
  formatPriceLabel,
  formatUsdFromLzt,
  getLiveHostsCount,
  isGameLive,
  resolveCoverImageUrl,
  type BoolFilterKey,
  type SortKey,
} from "./games-helpers";

type FilterKey = BoolFilterKey | "liveOnly";

type GameEnriched = GameListItem & {
  category?: string;
  genres?: string[];
  createdAt?: string;
  liveHostsCount?: number;
  vdsHostsCount?: number;
  hasVdsHosts?: boolean;
  minPricePerMinuteLzt?: number | null;
  browserHostUrl?: string | null;
};

const BOOL_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "isMultiplayer", label: "Мультиплеер" },
  { key: "hasMods", label: "С модами" },
  { key: "hostSpectatesPlayer", label: "Хост наблюдает" },
  { key: "hasQuests", label: "С квестами" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "mostOnline", label: "Больше онлайн-хостов" },
  { key: "cheapest", label: "Сначала дешевле" },
  { key: "newest", label: "Новые игры" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GamesPage() {
  const { playerWalletToken, registerGuest } = usePlayerWallet();

  useEffect(() => {
    if (!playerWalletToken) void registerGuest();
  }, [playerWalletToken, registerGuest]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [liveOnly, setLiveOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("mostOnline");
  const [boolFilters, setBoolFilters] = useState<Record<FilterKey, boolean>>({
    hasMods: false,
    isMultiplayer: false,
    hostSpectatesPlayer: false,
    hasQuests: false,
    liveOnly: false,
  });
  const [maxLzt, setMaxLzt] = useState<number>(9999);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const sliderInitRef = useRef(false);

  const apiParams = useMemo(
    () => buildGamesApiParams({ boolFilters, liveOnly, debouncedSearch, category }),
    [boolFilters, liveOnly, debouncedSearch, category],
  );

  const { data: rawGames, isLoading, isError, refetch, isFetching } = useListGames(apiParams, {
    query: { queryKey: getListGamesQueryKey(apiParams) },
  });

  const vdsParams = { vdsOnly: true, liveOnly: true };
  const { data: vdsGamesRaw } = useListGames(vdsParams, {
    query: { queryKey: getListGamesQueryKey(vdsParams) },
  });
  const vdsGames = (vdsGamesRaw ?? []) as GameEnriched[];

  const games = (rawGames ?? []) as GameEnriched[];

  const categories = useMemo(() => extractCategories(games), [games]);

  const allGenres = useMemo(() => extractAllGenres(games), [games]);

  const globalMaxLzt = useMemo(() => computeGlobalMaxLzt(games), [games]);

  useEffect(() => {
    if (!sliderInitRef.current && globalMaxLzt > 0) {
      setMaxLzt(globalMaxLzt);
      sliderInitRef.current = true;
    }
  }, [globalMaxLzt]);

  const toggleGenre = (genre: string) =>
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );

  const sorted = useMemo(
    () => filterAndSortGames(games, sort, maxLzt, selectedGenres),
    [games, sort, maxLzt, selectedGenres],
  );

  const toggleBool = (key: FilterKey) =>
    setBoolFilters((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/games" />

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Gamepad2 className="h-7 w-7 text-sky-400" />
              Каталог игр
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Выбери игру и подключись к хосту в один клик.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Поиск игр…"
              className="pl-9 h-9 rounded-md"
              style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-games"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-5 w-52 shrink-0 pt-1">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" /> Только онлайн
              </div>
              <button
                type="button"
                onClick={() => setLiveOnly((v) => !v)}
                className="w-full h-8 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 px-3"
                style={{
                  background: liveOnly ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.04)",
                  border: liveOnly ? "1px solid rgba(45,212,191,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  color: liveOnly ? "#2dd4bf" : "#64748b",
                }}
                data-testid="filter-liveOnly"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${liveOnly ? "bg-teal-400" : "bg-slate-600"}`} />
                {liveOnly ? "Только онлайн" : "Все игры"}
              </button>
            </div>

            {categories.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">Категория</div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className="text-left text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: !category ? "rgba(14,165,233,0.12)" : "transparent",
                      color: !category ? "#38bdf8" : "#64748b",
                    }}
                  >
                    Все категории
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat === category ? "" : cat)}
                      className="text-left text-xs px-2 py-1 rounded transition-colors truncate"
                      style={{
                        background: category === cat ? "rgba(14,165,233,0.12)" : "transparent",
                        color: category === cat ? "#38bdf8" : "#64748b",
                      }}
                      data-testid={`filter-category-${cat}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">Возможности</div>
              <div className="flex flex-col gap-1">
                {BOOL_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleBool(f.key)}
                    className="text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                    style={{
                      background: boolFilters[f.key] ? "rgba(14,165,233,0.12)" : "transparent",
                      color: boolFilters[f.key] ? "#38bdf8" : "#64748b",
                    }}
                    data-testid={`filter-${f.key}`}
                  >
                    <span
                      className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: boolFilters[f.key] ? "#0ea5e9" : "rgba(255,255,255,0.12)",
                        background: boolFilters[f.key] ? "#0ea5e9" : "transparent",
                      }}
                    >
                      {boolFilters[f.key] && <span className="w-1.5 h-1.5 rounded-sm bg-white" />}
                    </span>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {allGenres.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">Жанры</div>
                <div className="flex flex-col gap-1">
                  {allGenres.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className="text-left text-xs px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                      style={{
                        background: selectedGenres.includes(genre)
                          ? "rgba(14,165,233,0.12)"
                          : "transparent",
                        color: selectedGenres.includes(genre) ? "#38bdf8" : "#64748b",
                      }}
                      data-testid={`filter-genre-${genre}`}
                    >
                      <span
                        className="w-3 h-3 rounded border flex items-center justify-center flex-shrink-0"
                        style={{
                          borderColor: selectedGenres.includes(genre)
                            ? "#0ea5e9"
                            : "rgba(255,255,255,0.12)",
                          background: selectedGenres.includes(genre)
                            ? "#0ea5e9"
                            : "transparent",
                        }}
                      >
                        {selectedGenres.includes(genre) && (
                          <span className="w-1.5 h-1.5 rounded-sm bg-white" />
                        )}
                      </span>
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">Соединение</div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Пинг до хоста смотри на странице «Хосты» — там живые карточки с задержкой.
              </p>
            </div>

            {globalMaxLzt > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2 font-mono">
                  Макс. цена: {maxLzt} LZT/мин
                </div>
                <input
                  type="range"
                  min={0}
                  max={globalMaxLzt}
                  value={maxLzt}
                  onChange={(e) => setMaxLzt(Number(e.target.value))}
                  className="w-full accent-sky-400"
                  style={{ accentColor: "#0ea5e9" }}
                  data-testid="slider-max-price"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-0.5">
                  <span>0</span>
                  <span>{globalMaxLzt}</span>
                </div>
              </div>
            )}
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="lg:hidden flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setLiveOnly((v) => !v)}
                className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 flex-shrink-0 transition-colors"
                style={{
                  background: liveOnly ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.04)",
                  border: liveOnly ? "1px solid rgba(45,212,191,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  color: liveOnly ? "#2dd4bf" : "#64748b",
                }}
                data-testid="filter-liveOnly-mobile"
              >
                <Activity className="h-3.5 w-3.5" />
                {liveOnly ? "Онлайн" : "Все игры"}
              </button>
              {BOOL_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleBool(f.key)}
                  className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0 transition-colors"
                  style={{
                    background: boolFilters[f.key] ? "#0ea5e9" : "rgba(14,165,233,0.06)",
                    color: boolFilters[f.key] ? "#fff" : "#94a3b8",
                    border: boolFilters[f.key] ? "1px solid #0ea5e9" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort + stats bar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="text-xs text-slate-600 font-mono">
                {isLoading ? "…" : `${sorted.length} игр`}
              </span>
              <div className="flex items-center gap-1">
                {SORT_OPTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSort(s.key)}
                    className="h-7 px-2.5 rounded text-[11px] font-medium transition-colors"
                    style={{
                      background: sort === s.key ? "rgba(14,165,233,0.15)" : "transparent",
                      color: sort === s.key ? "#38bdf8" : "#475569",
                      border: sort === s.key ? "1px solid rgba(14,165,233,0.3)" : "1px solid transparent",
                    }}
                    data-testid={`sort-${s.key}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {vdsGames.length > 0 && (
              <section className="mb-10">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-400" />
                  Всегда онлайн
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {vdsGames.map((g) => (
                    <div key={g.id} className="min-w-[180px] max-w-[200px] shrink-0">
                      <GameCard game={g} vdsBadge />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[3/4] rounded-xl animate-pulse"
                    style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.05)" }}
                  />
                ))}
              </div>
            ) : isError ? (
              <div
                className="text-center py-20 rounded-xl"
                style={{ background: "#0a1018", border: "1px dashed rgba(239,68,68,0.25)" }}
              >
                <AlertCircle className="h-12 w-12 text-red-400/70 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-300">Не удалось загрузить каталог</p>
                <p className="text-sm text-slate-500 mt-1">Проверьте соединение и попробуйте снова.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4 border-white/10 text-slate-300"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                >
                  {isFetching ? "Загрузка…" : "Повторить"}
                </Button>
              </div>
            ) : sorted.length === 0 ? (
              <div
                className="text-center py-20 rounded-xl"
                style={{ background: "#0a1018", border: "1px dashed rgba(255,255,255,0.08)" }}
              >
                <Gamepad2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-300">Ничего не найдено</p>
                <p className="text-sm text-slate-500 mt-1">
                  Попробуй убрать фильтры или изменить поисковый запрос.
                </p>
                {liveOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-4 border-white/10 text-slate-400"
                    onClick={() => setLiveOnly(false)}
                  >
                    Показать все игры
                  </Button>
                )}
              </div>
            ) : (
              <div
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4"
                data-testid="grid-games"
              >
                {sorted.map((g) => (
                  <GameCard key={g.id} game={g as GameEnriched} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function GameCard({ game, vdsBadge }: { game: GameEnriched; vdsBadge?: boolean }) {
  const [, navigate] = useLocation();
  const { playerWalletToken, isRegistering, registerGuest } = usePlayerWallet();
  const createBrowserHost = useCreateBrowserHostSession();

  const handleHost = async () => {
    let token = playerWalletToken;
    if (!token) {
      token = await registerGuest();
      if (!token) {
        toast.error("Не удалось создать кошелёк, попробуй ещё раз");
        return;
      }
    }
    try {
      const res = await createBrowserHost.mutateAsync({
        data: { playerWalletToken: token, gameSlug: game.slug },
      });
      try {
        localStorage.setItem(HOST_TOKEN_STORAGE_PREFIX + res.session.id, res.hostToken);
        localStorage.setItem(BROWSER_HOST_URL_STORAGE_PREFIX + res.session.id, res.browserHostUrl);
      } catch { /* ignore */ }
      navigate(`/host/play/${res.session.id}`);
    } catch (err) {
      toast.error(formatApiError(err, "Не удалось создать сессию хоста"));
    }
  };

  const cover = game.coverImageUrl
    ? resolveCoverImageUrl(game.coverImageUrl, import.meta.env.BASE_URL)
    : null;

  const liveHosts = getLiveHostsCount(game);
  const minLzt = game.minPricePerMinuteLzt;
  const priceLabel = formatPriceLabel(minLzt);
  const isLive = isGameLive(game);

  return (
    <div
      className="group relative overflow-hidden rounded-xl transition-all cursor-pointer"
      style={{ background: "#0a1018", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid={`card-game-${game.slug}`}
    >
      <div className="aspect-[3/4] w-full bg-slate-900">
        {cover ? (
          <img
            src={cover}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="h-12 w-12 text-slate-700" />
          </div>
        )}
      </div>

      {(vdsBadge || game.hasVdsHosts) && (
        <div className="absolute top-2.5 left-2.5">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(56,189,248,0.9)", color: "#fff" }}
          >
            Всегда онлайн
          </span>
        </div>
      )}

      {/* Live hosts badge */}
      {isLive && (
        <div className="absolute top-2.5 right-2.5">
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "rgba(20,184,166,0.85)", color: "#fff" }}
          >
            <Users className="h-2.5 w-2.5" />
            {liveHosts}
          </span>
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06090e]/96 via-[#06090e]/30 to-transparent p-3 flex flex-col justify-end">
        <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{game.title}</h3>
        {game.genre && (
          <p className="text-[10px] text-sky-400 font-mono mt-0.5 truncate">{game.genre}</p>
        )}
        <p
          className="text-[10px] font-mono mt-1"
          style={{ color: isLive ? "#34d399" : "#64748b" }}
          data-testid={`text-price-${game.slug}`}
        >
          {priceLabel}
          {minLzt != null && (
            <span className="text-slate-600"> · ≈${formatUsdFromLzt(minLzt)}</span>
          )}
        </p>
        <div className="mt-2 flex flex-col gap-1">
          <Link href={`/games/${game.slug}`}>
            <Button
              size="sm"
              className="w-full h-7 text-[11px] font-semibold rounded-md"
              style={{
                background: isLive ? "#0ea5e9" : "rgba(14,165,233,0.10)",
                color: isLive ? "#fff" : "#38bdf8",
                border: isLive ? "none" : "1px solid rgba(14,165,233,0.2)",
              }}
              data-testid={`button-open-${game.slug}`}
            >
              {isLive ? "Играть" : "Подробнее"}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          {game.browserHostUrl && (
            <Button
              size="sm"
              type="button"
              onClick={handleHost}
              disabled={createBrowserHost.isPending || isRegistering}
              className="w-full h-7 text-[11px] font-semibold rounded-md"
              style={{
                background: "rgba(16,185,129,0.14)",
                color: "#34d399",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
              data-testid={`button-host-${game.slug}`}
            >
              <Rocket className="mr-1 h-3 w-3" />
              {createBrowserHost.isPending ? "…" : "Хостить"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
