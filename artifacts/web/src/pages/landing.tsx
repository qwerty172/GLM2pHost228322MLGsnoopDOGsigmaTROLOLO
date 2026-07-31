import type * as React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Gamepad2,
  ArrowRight,
  Zap,
  Cpu,
  CircleDollarSign,
  Lock,
  Users,
  ChevronRight,
  Play,
  Server,
} from "lucide-react";
import { useState } from "react";
import {
  useGetPublicStats,
  getGetPublicStatsQueryKey,
  useListGames,
  getListGamesQueryKey,
  useListPublicHosts,
  getListPublicHostsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { usePlayerWallet } from "@/hooks/use-player-wallet";

function formatInt(n: number): string {
  // 1248 → "1 248" (Russian thin-space grouping).
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function formatUsd(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${formatInt(dollars)}`;
}

function coverSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, "")}`;
}

type LiveHost = {
  id: string;
  displayName: string;
  boundAppLabel: string;
  pricePerHourUsd: number;
  minutePriceUsd: number;
  status: string;
  inviteCode: string | null;
  tags: string[];
  games: Array<{ slug: string; title: string; coverImageUrl: string; genre: string; pricePerMinuteLzt: number }>;
};

function useLiveHosts() {
  return useListPublicHosts({
    query: {
      queryKey: getListPublicHostsQueryKey(),
      refetchInterval: 30_000,
      staleTime: 15_000,
    },
  }) as { data: LiveHost[] | undefined };
}

export default function Landing() {
  const [shareLink, setShareLink] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [, navigate] = useLocation();
  const { playerWalletToken, registerGuest } = usePlayerWallet();
  const { data: liveHosts } = useLiveHosts();
  const { data: stats } = useGetPublicStats({
    query: {
      queryKey: getGetPublicStatsQueryKey(),
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  });
  const { data: catalogGames } = useListGames(
    { sort: "mostOnline" } as Record<string, boolean | string>,
    {
      query: {
        queryKey: getListGamesQueryKey({ sort: "mostOnline" } as Record<string, boolean | string>),
        staleTime: 60_000,
      },
    },
  );

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = shareLink.trim();
    if (!raw) return;

    const extractAfter = (haystack: string, marker: string): string | null => {
      const idx = haystack.indexOf(marker);
      if (idx < 0) return null;
      const rest = haystack.slice(idx + marker.length).split(/[/?#]/)[0];
      return rest || null;
    };

    try {
      const path =
        raw.includes("://") || raw.startsWith("/")
          ? new URL(raw, window.location.origin).pathname + new URL(raw, window.location.origin).search
          : raw;
      const inviteCode = extractAfter(path, "/play/i/") ?? extractAfter(raw, "/play/i/");
      if (inviteCode) {
        window.location.href = `${import.meta.env.BASE_URL}play/i/${inviteCode}`;
        return;
      }
      const playerToken = extractAfter(path, "/play/") ?? extractAfter(raw, "/play/");
      if (playerToken) {
        window.location.href = `${import.meta.env.BASE_URL}play/${playerToken}`;
        return;
      }
    } catch {
      /* fall through to bare token */
    }

    window.location.href = `${import.meta.env.BASE_URL}play/${raw}`;
  };

  const handlePlayNow = (host: LiveHost) => {
    if (!host.inviteCode) return;
    // Guest wallet создаётся на /play — не блокируем навигацию.
    if (!playerWalletToken) void registerGuest();
    navigate(`/play/i/${host.inviteCode}`);
  };

  const playableHosts = (liveHosts ?? [])
    .filter((h) => h.status === "online" && h.inviteCode)
    .slice(0, 6);

  const statItems: { num: string; label: string; icon: React.ReactNode; testid: string }[] = [
    {
      num: stats ? formatInt(stats.hostsOnline) : "—",
      label: "хостов онлайн",
      icon: <Cpu className="w-4 h-4" />,
      testid: "stat-hosts-online",
    },
    {
      num: stats ? formatInt(stats.activeSessions) : "—",
      label: "активных сессий",
      icon: <Activity className="w-4 h-4" />,
      testid: "stat-active-sessions",
    },
    {
      num: stats ? formatUsd(stats.totalPaidOutCents) : "—",
      label: "выплачено хостам",
      icon: <CircleDollarSign className="w-4 h-4" />,
      testid: "stat-paid-out",
    },
  ];

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
        .game-card {
          background: #0a1018;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          overflow: hidden;
          transition: border-color .2s;
        }
        .game-card:hover { border-color: rgba(14,165,233,0.3); }
      `}</style>

      <SiteNav activePath="/" />

      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10 flex flex-col lg:flex-row items-start gap-12">
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-5"
            style={{
              background: "rgba(14,165,233,0.08)",
              color: "#38bdf8",
              border: "1px solid rgba(14,165,233,0.18)",
            }}
          >
            <Activity className="w-3 h-3" /> Облачный гейминг · P2P · без дата-центров
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Аренда gaming-ПК
            <br />
            <span style={{ color: "#0ea5e9" }}>напрямую у владельцев</span>
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-7 max-w-lg">
            Владельцы мощных ПК стримят их тебе прямо в браузер.
            Платишь за фактические минуты игры — без подписок и очередей.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link href="/hosts">
              <Button
                className="h-9 px-5 text-sm font-semibold rounded-md"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" /> Играть
              </Button>
            </Link>
            <Link href="/host">
              <Button
                variant="ghost"
                className="h-9 px-5 text-sm text-slate-400 hover:text-white rounded-md"
              >
                Стать хостом
              </Button>
            </Link>
          </div>

          <div className="mt-5">
            {!showLinkInput ? (
              <button
                onClick={() => setShowLinkInput(true)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                У меня есть ссылка от друга
              </button>
            ) : (
              <form
                onSubmit={handleJoin}
                className="flex items-center gap-2 max-w-md"
              >
                <Input
                  autoFocus
                  placeholder="Вставьте ссылку или токен хоста…"
                  className="h-8 text-xs rounded-md"
                  style={{
                    background: "#0a1018",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e2e8f0",
                  }}
                  value={shareLink}
                  onChange={(e) => setShareLink(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-8 px-4 text-xs shrink-0 rounded-md border-white/10 hover:border-sky-500/40 text-slate-400 hover:text-white"
                >
                  Войти
                </Button>
              </form>
            )}
          </div>
        </div>

        <div className="surface-card p-5 flex gap-8 shrink-0 lg:self-center">
          {statItems.map((s) => (
            <div key={s.label} className="text-center" data-testid={s.testid}>
              <div className="flex justify-center mb-1 text-teal-400 opacity-70">
                {s.icon}
              </div>
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                {s.num}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {playableHosts.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#2dd4bf" }}
            >
              <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" style={{ boxShadow: "0 0 6px rgba(45,212,191,0.7)" }} />
              Играй прямо сейчас
            </span>
            <span className="text-xs text-slate-600">· {playableHosts.length} хост{playableHosts.length === 1 ? "" : "а"} онлайн</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {playableHosts.map((host) => {
              const firstGame = host.games?.[0];
              const cover = firstGame?.coverImageUrl
                ? coverSrc(firstGame.coverImageUrl)
                : null;
              const gameTitle = firstGame?.title ?? host.boundAppLabel ?? "Игра";
              const lztPerMin = firstGame?.pricePerMinuteLzt
                ?? Math.round(host.minutePriceUsd * 200);
              return (
                <div
                  key={host.id}
                  className="shrink-0 rounded-xl overflow-hidden flex flex-col"
                  style={{
                    width: 160,
                    background: "#0a1018",
                    border: "1px solid rgba(45,212,191,0.2)",
                  }}
                >
                  <div className="relative" style={{ height: 100 }}>
                    {cover ? (
                      <img
                        src={cover}
                        alt={gameTitle}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: "rgba(14,165,233,0.05)" }}
                      >
                        <Server className="w-8 h-8 text-slate-700" />
                      </div>
                    )}
                    <div
                      className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(10,16,24,0.9) 0%, transparent 60%)" }}
                    />
                    <div className="absolute bottom-1.5 left-2 right-2">
                      <p className="text-[11px] font-bold text-white leading-tight truncate">{gameTitle}</p>
                    </div>
                  </div>
                  <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 truncate">{host.displayName}</span>
                      <span className="text-[10px] font-mono text-sky-400">{lztPerMin} LZT/мин</span>
                    </div>
                    <button
                      className="w-full h-7 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-opacity hover:opacity-90"
                      style={{ background: "#0ea5e9", color: "#fff" }}
                      onClick={() => handlePlayNow(host)}
                      data-testid={`button-play-now-${host.id}`}
                    >
                      <Play className="w-3 h-3" /> Играть
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" /> Популярные игры
          </span>
          <Link href="/games">
            <button className="text-xs text-slate-500 hover:text-sky-400 flex items-center gap-1 transition-colors">
              Все игры <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {catalogGames && catalogGames.length > 0 ? (
            catalogGames.slice(0, 3).map((g) => {
                const src = coverSrc((g as any).coverImageUrl);
                const isLive = ((g as any).liveHostsCount ?? 0) > 0;
                const genre = (g as any).genre ?? (g as any).genres?.[0] ?? "";
                return (
                  <Link key={g.id} href={`/games/${g.slug}`}>
                    <div className="game-card cursor-pointer">
                      <div className="aspect-[3/4] relative">
                        {src ? (
                          <img
                            src={src}
                            alt={g.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ background: "rgba(14,165,233,0.05)" }}
                          >
                            <Gamepad2 className="w-10 h-10 text-slate-700" />
                          </div>
                        )}
                        {isLive && (
                          <div className="absolute top-2 right-2">
                            <span
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                              style={{ background: "rgba(20,184,166,0.85)", color: "#fff" }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                              В эфире
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#06090e]/90 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="text-sm font-bold text-white leading-tight">{g.title}</div>
                          {genre && (
                            <div className="text-[10px] text-sky-400 font-mono mt-0.5">{genre}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
          ) : (
            <div
              className="sm:col-span-3 surface-card p-8 text-center"
            >
              <Gamepad2 className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Каталог пока пуст</p>
              <p className="text-xs text-slate-600 mt-1">Загляни позже или стань хостом и добавь первую игру.</p>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="w-4 h-4 text-sky-400" />,
              title: "Задержка = твой пинг",
              text: "Стрим идёт напрямую с ПК хоста, без промежуточных серверов. Выбирай хоста ближе — играй без лагов.",
            },
            {
              icon: <CircleDollarSign className="w-4 h-4 text-teal-400" />,
              title: "Поминутная оплата",
              text: "Пополнение в USDT, SOL или Nano. Списывается только фактическое время, 95% уходит хосту.",
            },
            {
              icon: <Lock className="w-4 h-4 text-sky-400" />,
              title: "Ничего не устанавливать",
              text: "Открыл ссылку — играешь в браузере. Геймпад, клавиатура и тач-управление работают сразу.",
            },
          ].map((c) => (
            <div key={c.title} className="surface-card p-4">
              <div className="flex items-center gap-2 mb-2">
                {c.icon}
                <span className="text-sm font-semibold text-white">{c.title}</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-4 flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg text-xs text-slate-500"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span className="text-slate-600 font-medium">В разработке:</span>
          {["Фриланс-биржа", "Форум", "Кредитная линия"].map((item) => (
            <span
              key={item}
              className="px-2 py-0.5 rounded"
              style={{
                background: "rgba(14,165,233,0.06)",
                color: "#475569",
                border: "1px solid rgba(14,165,233,0.1)",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-14">
        <div className="surface-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold text-white">Видеокарта простаивает?</span>
            </div>
            <p className="text-xs text-slate-500">
              Запусти хост прямо в браузере или поставь агента — и получай
              95% с каждой минуты, пока кто-то играет на твоём железе.
            </p>
          </div>
          <Link href="/host">
            <Button
              size="sm"
              className="h-8 px-5 text-xs font-semibold rounded-md shrink-0"
              style={{
                background: "rgba(14,165,233,0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(14,165,233,0.2)",
              }}
            >
              Стать хостом <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer
        className="border-t px-6 py-5"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <span>DecentralHub · P2P Cloud Gaming · {new Date().getFullYear()}</span>
          <div className="flex items-center gap-4">
            <Link href="/games">
              <span className="hover:text-slate-400 cursor-pointer transition-colors">Игры</span>
            </Link>
            <Link href="/hosts">
              <span className="hover:text-slate-400 cursor-pointer transition-colors">Хосты</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
