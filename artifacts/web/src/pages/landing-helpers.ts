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
  status?: string;
  isOnline?: boolean;
  inviteCode: string | null;
};

export function isPlayableHost(host: PlayableHost): boolean {
  const online = host.status === "online" || host.isOnline === true;
  return online && !!host.inviteCode;
}

export function filterPlayableHosts<T extends PlayableHost>(
  hosts: T[] | null | undefined,
  limit = 6,
): T[] {
  return (hosts ?? []).filter(isPlayableHost).slice(0, limit);
}

export type RankablePlayableHost = PlayableHost & {
  hostTier?: string;
  pingMs?: number | null;
  minutePriceUsd?: number;
  games?: Array<{ pricePerMinuteLzt?: number }>;
};

function hostTierRank(tier: unknown): number {
  return tier === "above_rec" ? 0 : 1;
}

function hostPlayRank<T extends RankablePlayableHost>(host: T): number {
  const firstGame = host.games?.[0];
  return (
    firstGame?.pricePerMinuteLzt ??
    Math.round((host.minutePriceUsd ?? 0) * LZT_PER_USD)
  );
}

/** Лучший онлайн-хост для «Играть сейчас»: tier → ping → цена. */
export function pickBestPlayableHost<T extends RankablePlayableHost>(
  hosts: T[] | null | undefined,
): T | null {
  const playable = (hosts ?? []).filter(isPlayableHost);
  if (playable.length === 0) return null;

  return [...playable].sort((a, b) => {
    const tierDiff = hostTierRank(a.hostTier) - hostTierRank(b.hostTier);
    if (tierDiff !== 0) return tierDiff;

    const pingA = a.pingMs ?? Infinity;
    const pingB = b.pingMs ?? Infinity;
    if (pingA !== pingB) return pingA - pingB;

    return hostPlayRank(a) - hostPlayRank(b);
  })[0]!;
}

export function resolvePlayNowInvitePath(
  host: { inviteCode: string | null } | null | undefined,
): string | null {
  if (!host?.inviteCode) return null;
  return `/play/i/${host.inviteCode}`;
}

/** Путь для главного CTA, когда онлайн-хостов нет. */
export const PLAY_NOW_FALLBACK_HREF = "/games" as const;

/** Браузерная демо-игра без Windows-агента. */
export const DEMO_BROWSER_HREF = "/games/rogue-fable-3" as const;

export function computeLztPerMin(
  firstGame: { pricePerMinuteLzt?: number } | undefined,
  minutePriceUsd: number,
  lztPerUsd = LZT_PER_USD,
): number {
  return firstGame?.pricePerMinuteLzt ?? Math.round(minutePriceUsd * lztPerUsd);
}
