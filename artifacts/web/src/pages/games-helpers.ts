export const LZT_PER_USDT = 200;
export const DEFAULT_PRICE_PER_MIN_USD = 0.04;

export const HOST_TOKEN_STORAGE_PREFIX = "streamline.browserHostToken:";
export const BROWSER_HOST_URL_STORAGE_PREFIX = "streamline.browserHostUrl:";

export type SortKey = "mostOnline" | "cheapest" | "newest";

export type BoolFilterKey = "hasMods" | "isMultiplayer" | "hostSpectatesPlayer" | "hasQuests";

export type GameCatalogItem = {
  category?: string;
  genres?: string[];
  genre?: string;
  createdAt?: string;
  liveHostsCount?: number;
  liveSessionCount?: number;
  minPricePerMinuteLzt?: number | null;
  coverImageUrl?: string | null;
};

export const BOOL_FILTER_KEYS: BoolFilterKey[] = [
  "hasMods",
  "isMultiplayer",
  "hostSpectatesPlayer",
  "hasQuests",
];

export function buildGamesApiParams(opts: {
  boolFilters: Record<BoolFilterKey, boolean>;
  liveOnly: boolean;
  debouncedSearch: string;
  category: string;
}): Record<string, boolean | string> {
  const p: Record<string, boolean | string> = {};
  for (const key of BOOL_FILTER_KEYS) {
    if (opts.boolFilters[key]) p[key] = true;
  }
  if (opts.liveOnly) p.liveOnly = true;
  if (opts.debouncedSearch.trim()) p.search = opts.debouncedSearch.trim();
  if (opts.category) p.category = opts.category;
  return p;
}

export function extractCategories(games: GameCatalogItem[]): string[] {
  const seen = new Set<string>();
  const all: string[] = [];
  for (const g of games) {
    const cat = g.category;
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      all.push(cat);
    }
  }
  return all.sort();
}

export function extractAllGenres(games: GameCatalogItem[]): string[] {
  const seen = new Set<string>();
  for (const g of games) {
    const gg = g.genres ?? [];
    for (const genre of gg) if (genre) seen.add(genre);
    const sg = g.genre;
    if (sg) seen.add(sg);
  }
  return Array.from(seen).sort();
}

export function computeGlobalMaxLzt(games: GameCatalogItem[]): number {
  let m = 0;
  for (const g of games) {
    const p = g.minPricePerMinuteLzt;
    if (p != null && p > m) m = p;
  }
  return m || Math.round(DEFAULT_PRICE_PER_MIN_USD * LZT_PER_USDT * 3);
}

export function filterAndSortGames<T extends GameCatalogItem>(
  games: T[],
  sort: SortKey,
  maxLzt: number,
  selectedGenres: string[],
): T[] {
  let list = [...games].filter((g) => {
    const price = g.minPricePerMinuteLzt;
    if (price != null && price > maxLzt) return false;
    if (selectedGenres.length > 0) {
      const gg = g.genres ?? [];
      const sg = g.genre;
      const gameGenres = new Set([...gg, ...(sg ? [sg] : [])]);
      if (!selectedGenres.some((genre) => gameGenres.has(genre))) return false;
    }
    return true;
  });
  if (sort === "mostOnline") {
    list.sort((a, b) => (b.liveHostsCount ?? 0) - (a.liveHostsCount ?? 0));
  } else if (sort === "cheapest") {
    list.sort((a, b) => {
      const pa = a.minPricePerMinuteLzt ?? Infinity;
      const pb = b.minPricePerMinuteLzt ?? Infinity;
      return pa - pb;
    });
  } else if (sort === "newest") {
    list.sort((a, b) => {
      const da = a.createdAt ?? "";
      const db = b.createdAt ?? "";
      return db.localeCompare(da);
    });
  }
  return list;
}

export function resolveCoverImageUrl(coverImageUrl: string, baseUrl: string): string {
  if (coverImageUrl.startsWith("http")) return coverImageUrl;
  return `${baseUrl}${coverImageUrl.replace(/^\//, "")}`;
}

export function getLiveHostsCount(game: GameCatalogItem): number {
  return game.liveHostsCount ?? game.liveSessionCount ?? 0;
}

export function isGameLive(game: GameCatalogItem): boolean {
  return getLiveHostsCount(game) > 0;
}

export function formatPriceLabel(minLzt: number | null | undefined): string {
  return minLzt != null
    ? `${minLzt} LZT/мин`
    : `${Math.round(DEFAULT_PRICE_PER_MIN_USD * LZT_PER_USDT)} LZT/мин`;
}

export function formatUsdFromLzt(minLzt: number): string {
  return (minLzt / LZT_PER_USDT).toFixed(3);
}

/** U-28: честная подпись для офлайн-игр в каталоге. */
export function getOfflineAvailabilityLabel(): string {
  return "Сейчас нет хостов";
}

export function getPrimaryGameGenre(game: GameCatalogItem): string | null {
  const genre = game.genres?.[0] ?? game.genre ?? null;
  return genre?.trim() ? genre : null;
}

export function buildSimilarGamesHref(genre: string | null): string {
  if (!genre) return "/games";
  return `/games?genre=${encodeURIComponent(genre)}`;
}

export function getOfflineNotifyMessage(title: string): string {
  return `Готово! Мы покажем «${title}» выше в каталоге, когда появится хост.`;
}

export function parseGamesGenreFromSearch(search: string): string | null {
  const genre = new URLSearchParams(search).get("genre")?.trim();
  return genre || null;
}

/** U-29: счётчик активных фильтров каталога (для бейджа на мобильной кнопке). */
export function countActiveCatalogFilters(opts: {
  liveOnly: boolean;
  category: string;
  selectedGenres: string[];
  boolFilters: Record<BoolFilterKey, boolean>;
  maxLzt: number;
  globalMaxLzt: number;
}): number {
  let count = 0;
  if (opts.liveOnly) count++;
  if (opts.category) count++;
  count += opts.selectedGenres.length;
  for (const key of BOOL_FILTER_KEYS) {
    if (opts.boolFilters[key]) count++;
  }
  if (opts.globalMaxLzt > 0 && opts.maxLzt < opts.globalMaxLzt) count++;
  return count;
}
