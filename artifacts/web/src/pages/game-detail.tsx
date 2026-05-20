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
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
function formatScheduleSummary(slots: ScheduleSlot[]): string {
  if (!slots || slots.length === 0) return "нет слотов";
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

const chip = (active: boolean) => ({
  background: active ? "#0ea5e9" : "rgba(14,165,233,0.08)",
  color: active ? "#fff" : "#7dd3fc",
  border: active
    ? "1px solid #0ea5e9"
    : "1px solid rgba(14,165,233,0.18)",
});

export default function GameDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const search$ = useSearch();
  const [tag, setTag] = useState<string>("");
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
    <div
      className="min-h-screen text-slate-300"
      style={{ background: "#06090e" }}
    >
      <SiteNav activePath="/games" />

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
            style={{
              background: "#0a1018",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
          >
            <Gamepad2 className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-medium">Игра не найдена</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row gap-8 mb-10">
              <div
                className="w-full md:w-64 flex-shrink-0 aspect-[3/4] rounded-xl overflow-hidden"
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
              <div className="flex-1">
                <h1
                  className="text-4xl font-extrabold text-white tracking-tight"
                  data-testid="text-game-title"
                >
                  {game.title}
                </h1>
                {game.genre && (
                  <p className="text-sky-400 font-mono mt-1">{game.genre}</p>
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
              </div>
            </div>

            <section>
              <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2 flex-wrap text-white">
                <Activity className="h-5 w-5 text-sky-400" />
                Хосты онлайн
                <span
                  className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "#94a3b8",
                  }}
                >
                  {game.liveSessions.length}
                </span>
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
              {game.liveSessions.length === 0 ? (
                <div
                  className="text-center py-12 rounded-xl"
                  style={{
                    background: "#0a1018",
                    border: "1px dashed rgba(255,255,255,0.08)",
                  }}
                >
                  <p className="text-slate-400 text-sm">
                    Сейчас никто не стримит эту игру.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Загляни позже — или{" "}
                    <Link href="/host">
                      <span className="text-sky-400 hover:underline cursor-pointer">
                        стань хостом сам
                      </span>
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" data-testid="list-live-sessions">
                  {game.liveSessions.map((s) => (
                    <li
                      key={s.playerToken}
                      className="rounded-lg px-4 py-4 transition-colors"
                      style={{
                        background: "#0a1018",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                      data-testid={`live-host-${s.playerToken}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate text-white">
                              {s.hostDisplayName}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase"
                              style={chip(s.scheduleMode === "always")}
                            >
                              {s.scheduleMode === "always" ? "всегда" : "по расписанию"}
                            </span>
                            {s.streamPlatform && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded gap-1 inline-flex items-center"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  color: "#94a3b8",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <Radio className="h-3 w-3" />
                                {s.streamPlatform}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {s.boundUrl ? (
                              <a
                                href={s.boundUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sky-400 hover:underline"
                                data-testid={`link-bound-url-${s.playerToken}`}
                                title={s.boundUrl}
                              >
                                <Globe className="h-3 w-3" />
                                {s.boundAppLabel ||
                                  (() => {
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
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={chip(false)}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                          {s.description && (
                            <p
                              className="text-xs text-slate-400 mt-2 line-clamp-2"
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
                              <DollarSign className="h-3 w-3 text-sky-400" />
                              <span className="text-slate-500">запуск:</span>
                              <span
                                className={
                                  s.launchPriceUsd < 0
                                    ? "text-emerald-400 font-semibold"
                                    : "font-semibold text-white"
                                }
                              >
                                {formatPrice(s.launchPriceUsd)}
                              </span>
                            </span>
                            <span
                              className="flex items-center gap-1"
                              data-testid={`text-minute-price-${s.playerToken}`}
                            >
                              <Clock className="h-3 w-3 text-sky-400" />
                              <span className="text-slate-500">за минуту:</span>
                              <span
                                className={
                                  s.minutePriceUsd < 0
                                    ? "text-emerald-400 font-semibold"
                                    : "font-semibold text-white"
                                }
                              >
                                {formatPrice(s.minutePriceUsd)}
                              </span>
                            </span>
                            {s.scheduleMode === "scheduled" && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <Calendar className="h-3 w-3" />
                                {formatScheduleSummary(s.scheduleJson)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link href={`/play/${s.playerToken}`} className="shrink-0">
                          <Button
                            size="sm"
                            className="h-8 px-4 text-xs font-semibold rounded-md"
                            style={{ background: "#0ea5e9", color: "#fff" }}
                            data-testid={`button-join-${s.playerToken}`}
                          >
                            Подключиться
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
      </main>
    </div>
  );
}
