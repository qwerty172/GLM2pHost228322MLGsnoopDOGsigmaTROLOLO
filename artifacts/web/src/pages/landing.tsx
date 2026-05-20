import type * as React from "react";
import { Link } from "wouter";
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
} from "lucide-react";
import { useState } from "react";
import {
  useGetPublicStats,
  getGetPublicStatsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";

function formatInt(n: number): string {
  // 1248 → "1 248" (Russian thin-space grouping).
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function formatUsd(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${formatInt(dollars)}`;
}

export default function Landing() {
  const [shareLink, setShareLink] = useState("");
  const { data: stats } = useGetPublicStats({
    query: {
      queryKey: getGetPublicStatsQueryKey(),
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  });

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (shareLink) {
      const token = shareLink.split("/play/").pop() || shareLink;
      if (token) {
        window.location.href = `${import.meta.env.BASE_URL}play/${token}`;
      }
    }
  };

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
            <Activity className="w-3 h-3" /> WebRTC · P2P · без дата-центров
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Аренда gaming-ПК
            <br />
            <span style={{ color: "#0ea5e9" }}>напрямую у владельцев</span>
          </h1>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-7 max-w-lg">
            Никаких серверов компании — только реальные люди со своими GPU.
            Подключайся, плати криптой, запускай любую игру.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link href="/games">
              <Button
                className="h-9 px-5 text-sm font-semibold rounded-md"
                style={{ background: "#0ea5e9", color: "#fff" }}
              >
                Найти хоста <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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

          <form
            onSubmit={handleJoin}
            className="mt-6 flex items-center gap-2 max-w-md"
          >
            <Input
              placeholder="Вставьте ссылку хоста или токен…"
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
              Играть
            </Button>
          </form>
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
          {[
            { img: "game-1.png", title: "Cyberpunk 2077", req: "RTX 4090 · 1440p", live: true },
            { img: "game-2.png", title: "Elden Ring", req: "RTX 3080 · 1080p", live: false },
            { img: "game-3.png", title: "Helldivers 2", req: "RX 7900 · 1440p", live: true },
          ].map((g) => (
            <Link key={g.title} href="/games">
              <div className="game-card cursor-pointer">
                <div className="aspect-[3/4] relative">
                  <img
                    src={`${import.meta.env.BASE_URL}${g.img}`}
                    alt={g.title}
                    className="w-full h-full object-cover"
                  />
                  {g.live && (
                    <div className="absolute top-2 right-2">
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ background: "rgba(20,184,166,0.85)", color: "#fff" }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                        Live
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06090e]/90 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="text-sm font-bold text-white leading-tight">{g.title}</div>
                    <div className="text-[10px] text-sky-400 font-mono mt-0.5">{g.req}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Zap className="w-4 h-4 text-sky-400" />,
              title: "WebRTC · без прокси",
              text: "Прямое P2P-соединение. Задержка зависит только от пинга до хоста.",
            },
            {
              icon: <CircleDollarSign className="w-4 h-4 text-teal-400" />,
              title: "Крипто-кошелёк встроен",
              text: "USDT, Nano, Solana. Платишь поминутно, хост получает 95%.",
            },
            {
              icon: <Lock className="w-4 h-4 text-sky-400" />,
              title: "Открытый протокол",
              text: "Сигнальный сервер — единственная централизованная точка. Стриминг полностью P2P.",
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
              <span className="text-sm font-bold text-white">У тебя мощный ПК?</span>
            </div>
            <p className="text-xs text-slate-500">
              Сдавай его в аренду когда не играешь. Устанавливаешь агента,
              указываешь игру или URL — зарабатываешь крипту.
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
