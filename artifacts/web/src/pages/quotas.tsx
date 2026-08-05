import { Link } from "wouter";
import { useState } from "react";
import {
  useListPublicQuotas,
  useListMyQuotas,
  getListMyQuotasQueryKey,
  useListAppliedQuotas,
  getListAppliedQuotasQueryKey,
  useListGames,
  useGetHost,
  getGetHostQueryKey,
  type Quota,
} from "@workspace/api-client-react";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Sparkles, Coins, Lock, Globe, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { getQuotaCompatibility, QuotaCompatibility } from "@/lib/quota-compatibility";
import {
  quotaStatusMeta,
  quotaKindFilterLabel,
  buildPublicQuotaParams,
  selectQuotaRows,
  buildQuotaCompatibilityMap,
  filterQuotasBySearch,
  filterCompatibleQuotas,
  getQuotasLoadingState,
  getQuotasEmptyState,
  formatQuotaMinSpecs,
  formatRoyaltyRateLine,
  formatSponsorPricingLines,
  isQuotaIncompatible,
} from "./quotas-helpers";

const cardStyle = {
  background: "#0a1018",
  border: "1px solid rgba(255,255,255,0.06)",
} as const;

function statusBadge(status: Quota["status"]) {
  const v = quotaStatusMeta(status);
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ background: v.bg, color: v.color }}
    >
      {v.label}
    </span>
  );
}

function QuotaCard({
  q,
  compatibility,
}: {
  q: Quota;
  compatibility?: QuotaCompatibility | null;
}) {
  const isRoyalty = q.kind === "royalty";
  const incompatible = isQuotaIncompatible(compatibility);
  const minSpecs = formatQuotaMinSpecs(q);
  const sponsorLines = !isRoyalty ? formatSponsorPricingLines(q) : null;
  return (
    <Link href={`/quotas/${q.id}`}>
      <div
        className={`rounded-xl p-5 cursor-pointer transition-colors hover:border-sky-500/40 ${incompatible ? "opacity-60" : ""}`}
        style={{
          ...cardStyle,
          border: incompatible
            ? "1px solid rgba(244,63,94,0.25)"
            : cardStyle.border,
        }}
        data-testid={`quota-card-${q.id}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {isRoyalty ? (
              <Coins className="h-4 w-4 text-amber-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-sky-400" />
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: isRoyalty ? "#fbbf24" : "#38bdf8" }}
            >
              {isRoyalty ? "Роялти" : "Спонсор"}
            </span>
            {q.visibility === "private" ? (
              <Lock className="h-3 w-3 text-slate-500" />
            ) : (
              <Globe className="h-3 w-3 text-slate-500" />
            )}
            {compatibility?.compatible && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}
                data-testid={`quota-compatible-${q.id}`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Подходит
              </span>
            )}
            {incompatible && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: "rgba(244,63,94,0.15)", color: "#f87171" }}
                data-testid={`quota-incompatible-${q.id}`}
              >
                <AlertTriangle className="h-3 w-3" />
                Не подходит
              </span>
            )}
          </div>
          {statusBadge(q.status)}
        </div>
        <h3 className="text-base font-bold text-white leading-tight mb-1">
          {q.title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 min-h-[2rem]">
          {q.description || "Без описания"}
        </p>
        {incompatible && compatibility?.reason && (
          <p
            className="text-xs text-red-300/90 mb-3 rounded-md px-2 py-1.5"
            style={{ background: "rgba(244,63,94,0.08)" }}
            data-testid={`quota-incompatible-reason-${q.id}`}
          >
            {compatibility.reason}
          </p>
        )}
        <div className="text-xs font-mono text-slate-400 space-y-1 border-t border-white/5 pt-3">
          {isRoyalty ? (
            <div>{formatRoyaltyRateLine(q)}</div>
          ) : (
            sponsorLines && (
              <>
                <div>{sponsorLines.ratesLine}</div>
                <div className="text-emerald-300">{sponsorLines.escrowLine}</div>
              </>
            )
          )}
          {q.gameTitle && (
            <div className="text-slate-600">Игра: {q.gameTitle}</div>
          )}
          {minSpecs && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <span
                className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
              >
                {minSpecs}
              </span>
            </div>
          )}
          <div className="text-slate-600">Автор: {q.ownerDisplayName}</div>
        </div>
      </div>
    </Link>
  );
}

export default function QuotasPage() {
  const { hostToken } = useAuth();
  const [tab, setTab] = useState<"public" | "mine" | "applied">("public");
  const [kindFilter, setKindFilter] = useState<"" | "royalty" | "sponsor">("");
  const [gameFilter, setGameFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  const { data: hostMe } = useGetHost(hostToken ?? "", {
    query: {
      enabled: !!hostToken,
      queryKey: getGetHostQueryKey(hostToken ?? ""),
    },
  });
  const hostPcSpecs = (hostMe as { pcSpecs?: Parameters<typeof getQuotaCompatibility>[0] } | undefined)
    ?.pcSpecs;

  const { data: games } = useListGames({});
  const publicParams = buildPublicQuotaParams(kindFilter, gameFilter);
  const publicQuery = useListPublicQuotas(publicParams);
  const myParams = { ownerToken: hostToken ?? "" };
  const myQuery = useListMyQuotas(myParams, {
    query: {
      enabled: !!hostToken && tab === "mine",
      queryKey: getListMyQuotasQueryKey(myParams),
    },
  });
  const appliedQuery = useListAppliedQuotas(myParams, {
    query: {
      enabled: !!hostToken && tab === "applied",
      queryKey: getListAppliedQuotasQueryKey(myParams),
    },
  });

  const rows = selectQuotaRows(tab, myQuery.data, appliedQuery.data, publicQuery.data);
  const compatibilityMap = buildQuotaCompatibilityMap(hostToken, tab, rows, hostPcSpecs);
  const filtered = filterCompatibleQuotas(
    filterQuotasBySearch(rows, search),
    onlyCompatible,
    tab,
    hostToken,
    compatibilityMap,
  );
  const loading = getQuotasLoadingState(
    tab,
    myQuery.isLoading,
    appliedQuery.isLoading,
    publicQuery.isLoading,
  );
  const emptyState = getQuotasEmptyState(tab);

  return (
    <div className="min-h-screen text-slate-300" style={{ background: "#06090e" }}>
      <SiteNav activePath="/quotas" />
      <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Coins className="h-7 w-7 text-amber-400" />
              Квоты
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Пресет-контракты, которые меняют экономику сессии: роялти автору
              мода/аккаунта или спонсорский эскроу для оплачиваемых тестов и
              промо.
            </p>
          </div>
          <Link href="/quotas/new">
            <Button
              className="font-bold"
              style={{ background: "#0ea5e9", color: "#fff" }}
              data-testid="button-new-quota"
            >
              <Plus className="h-4 w-4 mr-2" /> Новая квота
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            className="h-8 px-3 rounded-full text-xs font-medium transition-colors"
            style={{
              background: tab === "public" ? "#0ea5e9" : "rgba(14,165,233,0.06)",
              color: tab === "public" ? "#fff" : "#94a3b8",
              border:
                tab === "public"
                  ? "1px solid #0ea5e9"
                  : "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={() => setTab("public")}
            data-testid="tab-public"
          >
            Все публичные
          </button>
          {hostToken && (
            <button
              type="button"
              className="h-8 px-3 rounded-full text-xs font-medium transition-colors"
              style={{
                background: tab === "mine" ? "#0ea5e9" : "rgba(14,165,233,0.06)",
                color: tab === "mine" ? "#fff" : "#94a3b8",
                border:
                  tab === "mine"
                    ? "1px solid #0ea5e9"
                    : "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setTab("mine")}
              data-testid="tab-mine"
            >
              Мои квоты
            </button>
          )}
          {hostToken && (
            <button
              type="button"
              className="h-8 px-3 rounded-full text-xs font-medium transition-colors"
              style={{
                background:
                  tab === "applied" ? "#0ea5e9" : "rgba(14,165,233,0.06)",
                color: tab === "applied" ? "#fff" : "#94a3b8",
                border:
                  tab === "applied"
                    ? "1px solid #0ea5e9"
                    : "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setTab("applied")}
              data-testid="tab-applied"
            >
              Применённые ко мне
            </button>
          )}
          <div className="h-6 w-px bg-white/10 mx-1" />
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="h-8 px-2 rounded-md text-xs"
            style={{
              background: "rgba(14,165,233,0.06)",
              color: gameFilter ? "#38bdf8" : "#94a3b8",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            data-testid="filter-game"
          >
            <option value="">Любая игра</option>
            {(games ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          {(["", "royalty", "sponsor"] as const).map((k) => (
            <button
              key={k || "all"}
              type="button"
              className="h-8 px-3 rounded-full text-xs transition-colors"
              style={{
                background:
                  kindFilter === k ? "rgba(14,165,233,0.18)" : "transparent",
                color: kindFilter === k ? "#38bdf8" : "#94a3b8",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setKindFilter(k)}
              data-testid={`filter-kind-${k || "all"}`}
            >
              {quotaKindFilterLabel(k)}
            </button>
          ))}
          {hostToken && tab === "public" && (
            <button
              type="button"
              className="h-8 px-3 rounded-full text-xs transition-colors"
              style={{
                background: onlyCompatible
                  ? "rgba(16,185,129,0.18)"
                  : "transparent",
                color: onlyCompatible ? "#34d399" : "#94a3b8",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setOnlyCompatible((v) => !v)}
              data-testid="filter-only-compatible"
            >
              {onlyCompatible ? "Только подходящие ✓" : "Только подходящие"}
            </button>
          )}
          <div className="relative w-full sm:w-64 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Поиск по названию…"
              className="pl-9 h-9 rounded-md"
              style={{
                background: "#0a1018",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e2e8f0",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-quotas"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl animate-pulse"
                style={cardStyle}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-20 rounded-xl"
            style={{
              background: "#0a1018",
              border: "1px dashed rgba(255,255,255,0.08)",
            }}
            data-testid="quotas-empty"
          >
            <Coins className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-300">{emptyState.title}</p>
            <p className="text-sm text-slate-500 mt-1">{emptyState.subtitle}</p>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            data-testid="quotas-grid"
          >
            {filtered.map((q) => (
              <QuotaCard
                key={q.id}
                q={q}
                compatibility={compatibilityMap.get(q.id) ?? null}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
