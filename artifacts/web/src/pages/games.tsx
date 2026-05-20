import { Link, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  useListGames,
  getListGamesQueryKey,
  type GameListItem,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowRight,
  Gamepad2,
  Search,
  Tag,
  Users,
  Wand2,
  Eye,
  Trophy,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

type FilterKey =
  | "hasMods"
  | "isMultiplayer"
  | "hostSpectatesPlayer"
  | "hasQuests"
  | "liveOnly";

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "liveOnly", label: "Сейчас онлайн", icon: Activity },
  { key: "isMultiplayer", label: "Мультиплеер", icon: Users },
  { key: "hasMods", label: "С модами", icon: Wand2 },
  { key: "hostSpectatesPlayer", label: "Хост наблюдает", icon: Eye },
  { key: "hasQuests", label: "С квестами", icon: Trophy },
];

export default function GamesPage() {
  const search$ = useSearch();
  const [active, setActive] = useState<Record<FilterKey, boolean>>({
    hasMods: false,
    isMultiplayer: false,
    hostSpectatesPlayer: false,
    hasQuests: false,
    liveOnly: false,
  });
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(search$);
    const t = sp.get("tag")?.trim() ?? "";
    setTag(t);
    setTagInput(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTag(next: string) {
    const trimmed = next.trim();
    setTag(trimmed);
    const sp = new URLSearchParams(window.location.search);
    if (trimmed) sp.set("tag", trimmed);
    else sp.delete("tag");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }

  const params = useMemo(() => {
    const p: Record<string, boolean | string> = {};
    for (const f of FILTERS) if (active[f.key]) p[f.key] = true;
    if (search.trim()) p.search = search.trim();
    if (tag) p.tag = tag;
    return p;
  }, [active, search, tag]);

  const { data: games, isLoading } = useListGames(params, {
    query: { queryKey: getListGamesQueryKey(params) },
  });

  const toggle = (key: FilterKey) =>
    setActive((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div
      className="min-h-screen text-slate-300"
      style={{ background: "#06090e" }}
    >
      <SiteNav activePath="/games" />

      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Gamepad2 className="h-7 w-7 text-sky-400" />
              Библиотека игр
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Каталог поддерживаемых игр. Фильтруй по возможностям и подключайся
              к живому хосту в один клик.
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Поиск игр…"
              className="pl-9 h-9 rounded-md"
              style={{
                background: "#0a1018",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e2e8f0",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-games"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => {
            const Icon = f.icon;
            const on = active[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggle(f.key)}
                className="h-8 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
                style={{
                  background: on ? "#0ea5e9" : "rgba(14,165,233,0.06)",
                  color: on ? "#fff" : "#94a3b8",
                  border: on
                    ? "1px solid #0ea5e9"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
                data-testid={`filter-${f.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-8">
          <div className="relative w-full sm:w-72">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Тег возможностей хоста…"
              className="pl-9 h-9 rounded-md"
              style={{
                background: "#0a1018",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e2e8f0",
              }}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyTag(tagInput);
                }
              }}
              data-testid="input-tag-filter"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-md border-white/10 text-slate-400 hover:text-white"
            onClick={() => applyTag(tagInput)}
            data-testid="button-apply-tag"
          >
            Применить
          </Button>
          {tag && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded cursor-pointer"
              style={{
                background: "#0ea5e9",
                color: "#fff",
              }}
              onClick={() => {
                setTagInput("");
                applyTag("");
              }}
              data-testid="badge-active-tag"
            >
              {tag}
              <X className="h-3 w-3" />
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-xl animate-pulse"
                style={{
                  background: "#0a1018",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              />
            ))}
          </div>
        ) : !games || games.length === 0 ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              background: "#0a1018",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            <Gamepad2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-300">
              По этим фильтрам ничего не найдено
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Попробуй убрать фильтр или поискать другое название.
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            data-testid="grid-games"
          >
            {games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function GameCard({ game }: { game: GameListItem }) {
  const cover = game.coverImageUrl
    ? game.coverImageUrl.startsWith("http")
      ? game.coverImageUrl
      : `${import.meta.env.BASE_URL}${game.coverImageUrl.replace(/^\//, "")}`
    : null;
  const isLive = game.liveSessionCount > 0;

  return (
    <div
      className="group relative overflow-hidden rounded-xl transition-all cursor-pointer"
      style={{
        background: "#0a1018",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      data-testid={`card-game-${game.slug}`}
    >
      <div className="aspect-[3/4] w-full">
        {cover ? (
          <img
            src={cover}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="h-16 w-16 text-slate-700" />
          </div>
        )}
      </div>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        {isLive && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(20,184,166,0.85)", color: "#fff" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white opacity-80" />
            {game.liveSessionCount} live
          </span>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#06090e]/95 via-[#06090e]/40 to-transparent p-4 flex flex-col justify-end">
        <h3 className="text-base font-bold text-white leading-tight">
          {game.title}
        </h3>
        {game.genre && (
          <p className="text-[11px] text-sky-400 font-mono mt-0.5">{game.genre}</p>
        )}
        <Link href={`/games/${game.slug}`}>
          <Button
            size="sm"
            className="mt-3 w-full h-8 text-xs font-semibold rounded-md"
            style={{
              background: isLive ? "#0ea5e9" : "rgba(14,165,233,0.12)",
              color: isLive ? "#fff" : "#38bdf8",
              border: isLive ? "none" : "1px solid rgba(14,165,233,0.2)",
            }}
            data-testid={`button-open-${game.slug}`}
          >
            {isLive ? "Найти хоста" : "Подробнее"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
