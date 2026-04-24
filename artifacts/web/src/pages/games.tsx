import { Link, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  useListGames,
  getListGamesQueryKey,
  type GameListItem,
} from "@workspace/api-client-react";
import { Activity, ArrowRight, Gamepad2, Search, Tag, Users, Wand2, Eye, Trophy, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  { key: "liveOnly", label: "Live now", icon: Activity },
  { key: "isMultiplayer", label: "Multiplayer", icon: Users },
  { key: "hasMods", label: "Has mods", icon: Wand2 },
  { key: "hostSpectatesPlayer", label: "Host spectates", icon: Eye },
  { key: "hasQuests", label: "Has quests", icon: Trophy },
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
  // The capability-tag filter is also reflected in `?tag=` so a host can
  // share a deep-link like /games?tag=Adobe%20license. We hydrate from the
  // URL on mount and write it back when the user edits the input.
  const [tag, setTag] = useState<string>("");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(search$);
    const t = sp.get("tag")?.trim() ?? "";
    setTag(t);
    setTagInput(t);
    // We intentionally only sync from the URL on mount; user edits below
    // are pushed back via history.replaceState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTag(next: string) {
    const trimmed = next.trim();
    setTag(trimmed);
    const sp = new URLSearchParams(window.location.search);
    if (trimmed) sp.set("tag", trimmed);
    else sp.delete("tag");
    const qs = sp.toString();
    const newUrl =
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }

  // Only send `true` filters; backend treats `undefined` as "no filter".
  const params = useMemo(() => {
    const p: Record<string, boolean | string> = {};
    for (const f of FILTERS) {
      if (active[f.key]) p[f.key] = true;
    }
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
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary text-xl hover:opacity-80 transition-opacity"
          >
            <Activity className="h-6 w-6" />
            STREAMLINE
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/host"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Host Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
                <Gamepad2 className="h-8 w-8 text-primary" />
                GAMES LIBRARY
              </h1>
              <p className="text-muted-foreground mt-2">
                Browse the catalog of supported games. Filter by capability or
                jump straight into a live host.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search games..."
                className="pl-9"
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
                <Button
                  key={f.key}
                  type="button"
                  variant={on ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => toggle(f.key)}
                  data-testid={`filter-${f.key}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {f.label}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-8">
            <div className="relative w-full sm:w-72">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by host capability tag…"
                className="pl-9"
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
              onClick={() => applyTag(tagInput)}
              data-testid="button-apply-tag"
            >
              Apply
            </Button>
            {tag && (
              <Badge
                variant="default"
                className="gap-1 cursor-pointer"
                onClick={() => {
                  setTagInput("");
                  applyTag("");
                }}
                data-testid="badge-active-tag"
              >
                {tag}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl border border-border/50 bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : !games || games.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
              <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No games match these filters</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try removing a filter or searching for a different title.
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
        </div>
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
      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/50"
      data-testid={`card-game-${game.slug}`}
    >
      <div className="aspect-[3/4] w-full bg-muted/30">
        {cover ? (
          <img
            src={cover}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="h-16 w-16 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        {isLive && (
          <Badge className="bg-emerald-500 text-emerald-50 hover:bg-emerald-500">
            <span className="h-2 w-2 rounded-full bg-emerald-200 mr-1.5 animate-pulse" />
            {game.liveSessionCount} live
          </Badge>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent p-5 flex flex-col justify-end">
        <h3 className="text-lg font-bold leading-tight">{game.title}</h3>
        {game.genre && (
          <p className="text-xs text-primary font-mono mt-0.5">{game.genre}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-3">
          {game.isMultiplayer && (
            <Badge variant="secondary" className="text-[10px]">
              <Users className="h-3 w-3 mr-1" /> Multi
            </Badge>
          )}
          {game.hasMods && (
            <Badge variant="secondary" className="text-[10px]">
              <Wand2 className="h-3 w-3 mr-1" /> Mods
            </Badge>
          )}
          {game.hostSpectatesPlayer && (
            <Badge variant="secondary" className="text-[10px]">
              <Eye className="h-3 w-3 mr-1" /> Spectate
            </Badge>
          )}
          {game.hasQuests && (
            <Badge variant="secondary" className="text-[10px]">
              <Trophy className="h-3 w-3 mr-1" /> Quests
            </Badge>
          )}
        </div>
        <Link href={`/games/${game.slug}`}>
          <Button
            size="sm"
            variant={isLive ? "default" : "secondary"}
            className="mt-4 w-full"
            data-testid={`button-open-${game.slug}`}
          >
            {isLive ? "Find a host" : "Details"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
