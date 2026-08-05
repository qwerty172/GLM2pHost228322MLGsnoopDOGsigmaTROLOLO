import type { PublicGameHostItem, ScheduleSlot } from "@workspace/api-client-react";

export const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function formatMinuteOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatScheduleSummary(slots: ScheduleSlot[]): string {
  if (!slots || slots.length === 0) return "нет слотов";
  return (
    slots
      .slice(0, 3)
      .map((s) => {
        return `${DAY_LABELS[s.day] ?? "?"} ${formatMinuteOfDay(s.startMin)}–${formatMinuteOfDay(s.endMin)}`;
      })
      .join(", ") + (slots.length > 3 ? "…" : "")
  );
}

export const chip = (active: boolean) => ({
  background: active ? "#0ea5e9" : "rgba(14,165,233,0.08)",
  color: active ? "#fff" : "#7dd3fc",
  border: active ? "1px solid #0ea5e9" : "1px solid rgba(14,165,233,0.18)",
});

export function sortHostsByLatency(
  hosts: PublicGameHostItem[],
  browserRtt: number | null,
): PublicGameHostItem[] {
  const tierRank = (t: unknown) => (t === "above_rec" ? 0 : 1);
  return [...hosts].sort((a, b) => {
    const tierDiff = tierRank(a.hostTier) - tierRank(b.hostTier);
    if (tierDiff !== 0) return tierDiff;
    const scoreA = a.pingMs != null ? (browserRtt ?? 0) + a.pingMs : Infinity;
    const scoreB = b.pingMs != null ? (browserRtt ?? 0) + b.pingMs : Infinity;
    return scoreA - scoreB;
  });
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 мин";
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
}

export function getLatencyColor(totalMs: number): string {
  return totalMs < 80 ? "#22c55e" : totalMs < 150 ? "#eab308" : "#ef4444";
}

export function getLatencyLabel(totalMs: number): string {
  return totalMs < 80 ? "низкая задержка" : totalMs < 150 ? "средняя задержка" : "высокая задержка";
}

export function computeTotalLatency(
  browserRtt: number | null,
  pingMs: number | null | undefined,
): number | null {
  return pingMs != null ? Math.round((browserRtt ?? 0) + pingMs) : null;
}

export function filterHostsByTag(
  hosts: PublicGameHostItem[],
  tag: string,
): PublicGameHostItem[] {
  if (!tag) return hosts;
  const lower = tag.toLowerCase();
  return hosts.filter((h) => (h.tags ?? []).some((t) => t.toLowerCase() === lower));
}

export function resolveCoverImageUrl(coverImageUrl: string, baseUrl: string): string {
  if (coverImageUrl.startsWith("http")) return coverImageUrl;
  return `${baseUrl}${coverImageUrl.replace(/^\//, "")}`;
}

export function getPingColor(pingMs: number | null): string {
  if (pingMs === null) return "#64748b";
  if (pingMs < 60) return "#2dd4bf";
  if (pingMs < 120) return "#eab308";
  return "#ef4444";
}

export function getPingLabel(pingMs: number | null): string {
  if (pingMs === null) return "нет данных";
  if (pingMs < 60) return "отлично";
  if (pingMs < 120) return "нормально";
  return "высокий";
}

export function computeMinsAvailable(
  totalAvailableLzt: number,
  pricePerMinuteLzt: number,
): number {
  return pricePerMinuteLzt > 0
    ? Math.floor(totalAvailableLzt / pricePerMinuteLzt)
    : 9999;
}

export function canAffordBlock(
  totalAvailableLzt: number,
  blockCost: number | null,
): boolean {
  return blockCost === null || totalAvailableLzt >= blockCost;
}
