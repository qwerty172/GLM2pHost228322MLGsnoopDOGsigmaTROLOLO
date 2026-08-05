import type { Quota } from "@workspace/api-client-react";
import {
  getQuotaCompatibility,
  type QuotaCompatibility,
} from "@/lib/quota-compatibility";
import { fmtLzt } from "./quota-detail-helpers";

export { fmtLzt };

export type QuotasTab = "public" | "mine" | "applied";
export type QuotaKindFilter = "" | "royalty" | "sponsor";

export function quotaStatusMeta(status: Quota["status"]): {
  bg: string;
  color: string;
  label: string;
} {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#1e293b", color: "#94a3b8", label: "Черновик" },
    active: { bg: "rgba(16,185,129,0.18)", color: "#34d399", label: "Активна" },
    paused: { bg: "rgba(234,179,8,0.18)", color: "#facc15", label: "Пауза" },
    exhausted: { bg: "rgba(244,63,94,0.18)", color: "#f87171", label: "Исчерпана" },
    expired: { bg: "rgba(148,163,184,0.18)", color: "#94a3b8", label: "Истекла" },
    closed: { bg: "rgba(148,163,184,0.18)", color: "#94a3b8", label: "Закрыта" },
  };
  return map[status] ?? map.draft!;
}

export function quotaKindFilterLabel(k: QuotaKindFilter): string {
  if (k === "") return "Любой тип";
  if (k === "royalty") return "Роялти";
  return "Спонсор";
}

export function buildPublicQuotaParams(
  kindFilter: QuotaKindFilter,
  gameFilter: string,
): { kind?: "royalty" | "sponsor"; gameId?: string } {
  const params: { kind?: "royalty" | "sponsor"; gameId?: string } = {};
  if (kindFilter) params.kind = kindFilter;
  if (gameFilter) params.gameId = gameFilter;
  return params;
}

export function selectQuotaRows(
  tab: QuotasTab,
  myData: Quota[] | undefined,
  appliedData: Quota[] | undefined,
  publicData: Quota[] | undefined,
): Quota[] {
  if (tab === "mine") return myData ?? [];
  if (tab === "applied") return appliedData ?? [];
  return publicData ?? [];
}

export function buildQuotaCompatibilityMap(
  hostToken: string | null | undefined,
  tab: QuotasTab,
  rows: Quota[],
  hostPcSpecs: Parameters<typeof getQuotaCompatibility>[0],
): Map<string, QuotaCompatibility> {
  const map = new Map<string, QuotaCompatibility>();
  if (!hostToken || tab !== "public") return map;
  for (const q of rows) {
    map.set(q.id, getQuotaCompatibility(hostPcSpecs, q));
  }
  return map;
}

export function filterQuotasBySearch(rows: Quota[], search: string): Quota[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.title.toLowerCase().includes(q) ||
      (row.description ?? "").toLowerCase().includes(q),
  );
}

export function filterCompatibleQuotas(
  rows: Quota[],
  onlyCompatible: boolean,
  tab: QuotasTab,
  hostToken: string | null | undefined,
  compatibilityMap: Map<string, QuotaCompatibility>,
): Quota[] {
  if (!onlyCompatible || tab !== "public" || !hostToken) return rows;
  return rows.filter((q) => compatibilityMap.get(q.id)?.compatible !== false);
}

export function getQuotasLoadingState(
  tab: QuotasTab,
  myLoading: boolean,
  appliedLoading: boolean,
  publicLoading: boolean,
): boolean {
  if (tab === "mine") return myLoading;
  if (tab === "applied") return appliedLoading;
  return publicLoading;
}

export function getQuotasEmptyState(tab: QuotasTab): { title: string; subtitle: string } {
  if (tab === "mine") {
    return {
      title: "У тебя пока нет квот",
      subtitle: "Создай первую — это бесплатно для черновика.",
    };
  }
  if (tab === "applied") {
    return {
      title: "К твоим сессиям ещё не применялись чужие квоты",
      subtitle:
        "Как только ты сыграешь под чьей-то квотой или хост прикрепит её к твоей игре — увидишь здесь.",
    };
  }
  return {
    title: "Ничего не найдено",
    subtitle: "Попробуй сменить тип или поискать другое название.",
  };
}

export function formatQuotaMinSpecs(q: Quota): string | null {
  if (q.minGpuVram == null && q.minRamGb == null) return null;
  const parts = [
    q.minGpuVram != null && `${q.minGpuVram}GB VRAM+`,
    q.minRamGb != null && `${q.minRamGb}GB RAM+`,
    q.minCpuCores != null && `${q.minCpuCores} ядер+`,
    q.minDownloadMbps != null && `${q.minDownloadMbps}Mbps+`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function formatRoyaltyRateLine(q: Quota): string {
  const rate =
    q.royaltyBasis === "percent"
      ? `${q.royaltyValue ?? 0}% / мин`
      : `${q.royaltyValue ?? 0} LZT/мин`;
  const source = q.royaltySource === "player" ? "с игрока" : "из доли хоста";
  return `${rate} (${source})`;
}

export function formatSponsorPricingLines(q: Quota): {
  ratesLine: string;
  escrowLine: string;
} {
  return {
    ratesLine: `Хосту: ${fmtLzt(q.sponsorHostPerMinuteLzt ?? 0)}/мин · Игроку: ${fmtLzt(q.sponsorPlayerPerMinuteLzt ?? 0)}/мин`,
    escrowLine: `Остаток эскроу: ${fmtLzt(q.escrowRemainingLzt)}`,
  };
}

export function isQuotaIncompatible(
  compatibility: QuotaCompatibility | null | undefined,
): boolean {
  return compatibility != null && !compatibility.compatible;
}
