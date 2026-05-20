import { Link } from "wouter";
import { Cpu, ExternalLink, FileCode, Globe } from "lucide-react";
import {
  useListPublicHosts,
  getListPublicHostsQueryKey,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";

function formatPrice(usd: number): string {
  const sign = usd < 0 ? "−" : "";
  return `${sign}$${Math.abs(usd).toFixed(2)}`;
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
        .row {
          background: #0a1018;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          transition: border-color .15s;
        }
        .row:hover { border-color: rgba(14,165,233,0.3); }
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
              Цены указаны в долларах, оплата криптой.
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
              <div
                key={i}
                className="h-24 rounded-lg surface-card animate-pulse"
              />
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
            {hosts.map((h) => (
              <div
                key={h.id}
                className="row p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                data-testid={`host-row-${h.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background:
                          h.status === "online" ? "#2dd4bf" : "#64748b",
                        boxShadow:
                          h.status === "online"
                            ? "0 0 6px rgba(45,212,191,0.7)"
                            : "none",
                      }}
                    />
                    <span className="font-semibold text-white truncate">
                      {h.displayName}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                      {h.status === "online" ? "онлайн" : "по расписанию"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono">
                    {h.boundUrlHost ? (
                      <span className="flex items-center gap-1 text-sky-400">
                        <Globe className="w-3 h-3" />
                        {h.boundAppLabel || h.boundUrlHost}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        {h.boundAppLabel || "без привязки"}
                      </span>
                    )}
                  </div>
                  {h.tags && h.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {h.tags.map((t) => (
                        <span key={t} className="tag-chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">
                      цена / час
                    </div>
                    <div
                      className="text-lg font-bold tracking-tight"
                      style={{
                        color: h.minutePriceUsd < 0 ? "#34d399" : "#f8fafc",
                      }}
                    >
                      {formatPrice(h.pricePerHourUsd)}
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">
                      {formatPrice(h.minutePriceUsd)}/мин
                    </div>
                  </div>
                  <Link href={`/play/${h.playerToken}`}>
                    <button
                      className="h-9 px-4 text-xs font-semibold rounded-md transition-colors"
                      style={{ background: "#0ea5e9", color: "#fff" }}
                      data-testid={`button-join-${h.id}`}
                    >
                      Подключиться
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
