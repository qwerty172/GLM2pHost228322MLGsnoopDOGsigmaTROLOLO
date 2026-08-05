import type {
  HostPcSpecs,
  PublicHostListItem,
  PublicHostListItemGamesItem,
  PublicHostListItemPcSpecs,
} from "@workspace/api-client-react";

export type SessionFailureReason = "game_unavailable" | "host_offline" | "error";

export function formatPrice(usd: number): string {
  const sign = usd < 0 ? "−" : "";
  return `${sign}$${Math.abs(usd).toFixed(2)}`;
}

export function resolveCoverImageUrl(
  url: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.replace(/^\//, "")}`;
}

export function getLatencyColor(totalMs: number): string {
  return totalMs < 80 ? "#22c55e" : totalMs < 150 ? "#eab308" : "#ef4444";
}

export function computeTotalLatency(
  browserRtt: number | null,
  pingMs: number | null | undefined,
): number | null {
  return pingMs != null ? Math.round((browserRtt ?? 0) + pingMs) : null;
}

export function mapSessionHttpStatus(status: number | undefined): SessionFailureReason {
  if (status === 409) return "game_unavailable";
  if (status === 503 || status === 404) return "host_offline";
  return "error";
}

/** Narrow openapi `record<string, unknown>` pcSpecs to known display fields. */
export function readHostPcSpecs(
  raw: PublicHostListItemPcSpecs | undefined,
): HostPcSpecs | null {
  if (!raw || typeof raw !== "object") return null;
  const specs: HostPcSpecs = {};
  if (typeof raw.cpu === "string") specs.cpu = raw.cpu;
  if (typeof raw.gpu === "string") specs.gpu = raw.gpu;
  if (typeof raw.ramGb === "number") specs.ramGb = raw.ramGb;
  if (!specs.cpu && !specs.gpu && specs.ramGb == null) return null;
  return specs;
}

export function getMinGamePriceLzt(games: PublicHostListItemGamesItem[]): number | null {
  if (games.length === 0) return null;
  return Math.min(...games.map((g) => g.pricePerMinuteLzt ?? 0));
}

export function sortPublicHosts(
  hosts: PublicHostListItem[],
  browserRtt: number | null,
  onlineOnly: boolean,
): PublicHostListItem[] {
  const tierRank = (t: unknown) => (t === "above_rec" ? 0 : 1);
  let list = [...hosts];
  if (onlineOnly) {
    list = list.filter((h) => !!h.isOnline);
  }
  return list.sort((a, b) => {
    const onlineA = a.isOnline ? 0 : 1;
    const onlineB = b.isOnline ? 0 : 1;
    if (onlineA !== onlineB) return onlineA - onlineB;
    const tierDiff = tierRank(a.hostTier) - tierRank(b.hostTier);
    if (tierDiff !== 0) return tierDiff;
    const scoreA = a.pingMs != null ? (browserRtt ?? 0) + a.pingMs : Infinity;
    const scoreB = b.pingMs != null ? (browserRtt ?? 0) + b.pingMs : Infinity;
    return scoreA - scoreB;
  });
}
