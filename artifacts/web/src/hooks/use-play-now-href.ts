import {
  useListPublicHosts,
  getListPublicHostsQueryKey,
} from "@workspace/api-client-react";
import {
  pickBestPlayableHost,
  resolvePlayNowInvitePath,
  PLAY_NOW_FALLBACK_HREF,
} from "@/pages/landing-helpers";

/** Путь для CTA «Играть» — прямой вход в сессию или каталог. */
export function usePlayNowHref(): string {
  const { data: hosts } = useListPublicHosts({
    query: {
      queryKey: getListPublicHostsQueryKey(),
      staleTime: 15_000,
    },
  });
  const best = pickBestPlayableHost(hosts);
  return resolvePlayNowInvitePath(best) ?? PLAY_NOW_FALLBACK_HREF;
}

/** Активен ли пункт «Играть» в навигации. */
export function isPlayNavActive(activePath?: string): boolean {
  if (!activePath) return false;
  if (activePath.startsWith("/play")) return true;
  if (activePath === "/games") return true;
  if (activePath === "/hosts") return true;
  return false;
}
