import type { CreateSessionBody } from "@workspace/api-client-react";

export const DEFAULT_PRESET_GAMES = [
  "Cyberpunk 2077",
  "Witcher 3",
  "Elden Ring",
  "Helldivers 2",
  "CS2",
] as const;

export const PRESET_GAMES_LIMIT = 6;

export type CatalogGameLike = { title: string };

export type QuotaRateLike = {
  kind: "royalty" | "sponsor";
  royaltyBasis?: string | null;
  royaltyValue?: number | null;
  sponsorHostPerMinuteLzt?: number | null;
  sponsorPlayerPerMinuteLzt?: number | null;
};

export function resolvePresetGames(
  catalogGames?: CatalogGameLike[] | null,
): string[] {
  if (catalogGames && catalogGames.length > 0) {
    return catalogGames.slice(0, PRESET_GAMES_LIMIT).map((g) => g.title);
  }
  return [...DEFAULT_PRESET_GAMES];
}

export function buildApplicableQuotasParams(
  hostToken: string | null | undefined,
  accessCode: string,
): { hostToken: string; accessCode?: string } {
  return {
    hostToken: hostToken ?? "",
    ...(accessCode ? { accessCode } : {}),
  };
}

export function canCreateSession(
  hostToken: string | null | undefined,
  appName: string,
): boolean {
  return !!hostToken && appName.trim().length > 0;
}

export function isSubmitDisabled(isPending: boolean, appName: string): boolean {
  return isPending || !appName.trim();
}

export function normalizeQuotaAccessCode(input: string): string {
  return input.toUpperCase();
}

export function buildShareLink(opts: {
  origin: string;
  baseUrl: string;
  playerToken: string;
  inviteCode?: string | null;
}): string {
  const base = `${opts.origin}${opts.baseUrl}`;
  if (opts.inviteCode) {
    return `${base}play/i/${opts.inviteCode}`;
  }
  return `${base}play/${opts.playerToken}`;
}

export function formatQuotaRateLabel(q: QuotaRateLike): string {
  if (q.kind === "royalty") {
    if (q.royaltyBasis === "percent") {
      return `${q.royaltyValue}% / мин`;
    }
    return `${q.royaltyValue} LZT/мин`;
  }
  return `Хост +${q.sponsorHostPerMinuteLzt ?? 0} · Игрок +${q.sponsorPlayerPerMinuteLzt ?? 0} LZT/мин`;
}

export function buildCreateSessionBody(opts: {
  hostToken: string;
  appName: string;
  resolution: string;
  bitrateKbps: number;
  selectedQuotaId: string | null;
  accessCode: string;
}): CreateSessionBody {
  return {
    hostToken: opts.hostToken,
    appName: opts.appName,
    resolution: opts.resolution,
    bitrateKbps: opts.bitrateKbps,
    quotaId: opts.selectedQuotaId,
    quotaAccessCode: opts.accessCode || undefined,
  };
}
