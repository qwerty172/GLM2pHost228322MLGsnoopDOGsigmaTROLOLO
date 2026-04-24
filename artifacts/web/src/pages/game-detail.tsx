import { Link, useParams, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  useGetGameBySlug,
  getGetGameBySlugQueryKey,
} from "@workspace/api-client-react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  DollarSign,
  Eye,
  ExternalLink,
  FileCode,
  Gamepad2,
  Globe,
  Radio,
  Trophy,
  Users,
  Wand2,
  X,
} from "lucide-react";
import type { ScheduleSlot } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function formatScheduleSummary(slots: ScheduleSlot[]): string {
  if (!slots || slots.length === 0) return "no slots";
  return (
    slots
      .slice(0, 4)
      .map((s) => {
        const fmt = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        return `${DAY_LABELS[s.day] ?? "?"} ${fmt(s.startMin)}–${fmt(s.endMin)}`;
      })
      .join(", ") + (slots.length > 4 ? "…" : "")
  );
}
function formatPrice(usd: number): string {
  const sign = usd < 0 ? "−" : "";
  return `${sign}$${Math.abs(usd).toFixed(usd === Math.floor(usd) ? 2 : 4)}`;
}

export default function GameDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const search$ = useSearch();
  // `?tag=...` lets a player narrow live hosts (e.g. only those with a
  // "leveled-up account"). The user can clear it from the badge below.
  const [tag, setTag] = useState<string>("");
  useEffect(() => {
    const sp = new URLSearchParams(search$);
    setTag(sp.get("tag")?.trim() ?? "");
  }, [search$]);
  const queryParams = useMemo(() => (tag ? { tag } : {}), [tag]);
  const { data: game, isLoading, isError } = useGetGameBySlug(
    slug,
    queryParams,
    {
      query: {
        enabled: !!slug,
        queryKey: getGetGameBySlugQueryKey(slug, queryParams),
      },
    },
  );

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

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold tracking-tight text-primary text-xl hover:opacity-80 transition-opacity"
          >
            <Activity className="h-6 w-6" />
            STREAMLINE
          </Link>
          <Link
            href="/games"
            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {isLoading ? (
            <div className="h-72 rounded-xl bg-muted/20 animate-pulse" />
          ) : isError || !game ? (
            <div className="text-center py-20 border border-dashed border-border/60 rounded-xl">
              <Gamepad2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">Game not found</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-8 mb-10">
                <div className="w-full md:w-64 flex-shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 border border-border/50">
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
                      <Gamepad2 className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h1
                    className="text-4xl md:text-5xl font-black tracking-tight"
                    data-testid="text-game-title"
                  >
                    {game.title}
                  </h1>
                  {game.genre && (
                    <p className="text-primary font-mono mt-1">{game.genre}</p>
                  )}
                  <p className="text-muted-foreground mt-4 leading-relaxed">
                    {game.description || "No description provided yet."}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {game.isMultiplayer && (
                      <Badge variant="secondary">
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Multiplayer
                      </Badge>
                    )}
                    {game.hasMods && (
                      <Badge variant="secondary">
                        <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Mods
                      </Badge>
                    )}
                    {game.hostSpectatesPlayer && (
                      <Badge variant="secondary">
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Host spectates
                      </Badge>
                    )}
                    {game.hasQuests && (
                      <Badge variant="secondary">
                        <Trophy className="h-3.5 w-3.5 mr-1.5" /> Quests
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2 flex-wrap">
                  <Activity className="h-5 w-5 text-primary" />
                  Live hosts
                  <Badge variant="outline">{game.liveSessions.length}</Badge>
                  {tag && (
                    <Badge
                      variant="default"
                      className="gap-1 cursor-pointer"
                      onClick={clearTag}
                      data-testid="badge-active-tag"
                      title="Click to clear filter"
                    >
                      tag: {tag} <X className="h-3 w-3" />
                    </Badge>
                  )}
                </h2>
                {game.liveSessions.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border/60 rounded-xl">
                    <p className="text-muted-foreground">
                      No hosts streaming this title right now.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check back later, or{" "}
                      <Link
                        href="/host"
                        className="text-primary hover:underline"
                      >
                        host it yourself
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3" data-testid="list-live-sessions">
                    {game.liveSessions.map((s) => (
                      <li
                        key={s.playerToken}
                        className="rounded-lg border border-border/50 bg-card px-4 py-4 hover:border-primary/50 transition-colors"
                        data-testid={`live-host-${s.playerToken}`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">
                                {s.hostDisplayName}
                              </span>
                              <Badge
                                variant={
                                  s.scheduleMode === "always"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {s.scheduleMode}
                              </Badge>
                              {s.streamPlatform && (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Radio className="h-3 w-3" />
                                  {s.streamPlatform}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {s.boundUrl ? (
                                <a
                                  href={s.boundUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                  data-testid={`link-bound-url-${s.playerToken}`}
                                  title={s.boundUrl}
                                >
                                  <Globe className="h-3 w-3" />
                                  {s.boundAppLabel || (() => {
                                    try {
                                      return new URL(s.boundUrl).hostname;
                                    } catch {
                                      return s.boundUrl;
                                    }
                                  })()}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <FileCode className="h-3 w-3" />
                                  {s.boundAppLabel || s.appName}
                                </span>
                              )}
                              <span>·</span>
                              <span>
                                {s.resolution} · {s.bitrateKbps} kbps
                              </span>
                            </div>
                            {s.tags && s.tags.length > 0 && (
                              <div
                                className="flex flex-wrap gap-1 mt-2"
                                data-testid={`tags-${s.playerToken}`}
                              >
                                {s.tags.map((t) => (
                                  <Badge
                                    key={t}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {s.description && (
                              <p
                                className="text-sm text-muted-foreground mt-2 line-clamp-2"
                                data-testid={`text-host-description-${s.playerToken}`}
                              >
                                {s.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                              <span
                                className="flex items-center gap-1"
                                data-testid={`text-launch-price-${s.playerToken}`}
                              >
                                <DollarSign className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">launch:</span>
                                <span
                                  className={
                                    s.launchPriceUsd < 0
                                      ? "text-emerald-400 font-semibold"
                                      : "font-semibold"
                                  }
                                >
                                  {formatPrice(s.launchPriceUsd)}
                                </span>
                              </span>
                              <span
                                className="flex items-center gap-1"
                                data-testid={`text-minute-price-${s.playerToken}`}
                              >
                                <Clock className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">per min:</span>
                                <span
                                  className={
                                    s.minutePriceUsd < 0
                                      ? "text-emerald-400 font-semibold"
                                      : "font-semibold"
                                  }
                                >
                                  {formatPrice(s.minutePriceUsd)}
                                </span>
                              </span>
                              {s.scheduleMode === "scheduled" && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {formatScheduleSummary(s.scheduleJson)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Link href={`/play/${s.playerToken}`} className="shrink-0">
                            <Button
                              size="sm"
                              data-testid={`button-join-${s.playerToken}`}
                            >
                              Join
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
