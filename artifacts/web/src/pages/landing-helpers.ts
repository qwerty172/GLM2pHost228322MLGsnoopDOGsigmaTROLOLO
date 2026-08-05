export const LZT_PER_USD = 200;

export function formatInt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatUsd(cents: number): string {
  const dollars = Math.round(cents / 100);
  return `$${formatInt(dollars)}`;
}

export function resolveCoverImageUrl(
  url: string | null | undefined,
  baseUrl: string,
): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${baseUrl}${url.replace(/^\//, "")}`;
}

export function extractAfter(haystack: string, marker: string): string | null {
  const idx = haystack.indexOf(marker);
  if (idx < 0) return null;
  const rest = haystack.slice(idx + marker.length).split(/[/?#]/)[0];
  return rest || null;
}

export function resolveJoinRedirectUrl(
  raw: string,
  baseUrl: string,
  origin = "https://example.com",
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const path =
      trimmed.includes("://") || trimmed.startsWith("/")
        ? new URL(trimmed, origin).pathname + new URL(trimmed, origin).search
        : trimmed;
    const inviteCode = extractAfter(path, "/play/i/") ?? extractAfter(trimmed, "/play/i/");
    if (inviteCode) {
      return `${baseUrl}play/i/${inviteCode}`;
    }
    const playerToken = extractAfter(path, "/play/") ?? extractAfter(trimmed, "/play/");
    if (playerToken) {
      return `${baseUrl}play/${playerToken}`;
    }
  } catch {
    /* fall through to bare token */
  }

  return `${baseUrl}play/${trimmed}`;
}

export type PlayableHost = {
  status: string;
  inviteCode: string | null;
};

export function filterPlayableHosts<T extends PlayableHost>(
  hosts: T[] | null | undefined,
  limit = 6,
): T[] {
  return (hosts ?? [])
    .filter((h) => h.status === "online" && h.inviteCode)
    .slice(0, limit);
}

export function computeLztPerMin(
  firstGame: { pricePerMinuteLzt?: number } | undefined,
  minutePriceUsd: number,
  lztPerUsd = LZT_PER_USD,
): number {
  return firstGame?.pricePerMinuteLzt ?? Math.round(minutePriceUsd * lztPerUsd);
}
