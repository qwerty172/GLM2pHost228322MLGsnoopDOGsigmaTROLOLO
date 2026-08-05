export const LZT_PER_USD = 200;

export type LibraryEntryKind = "native" | "browser";

export type LibraryEntryLike = {
  boundUrl?: string | null;
  game: { browserHostUrl?: string | null };
};

export type AddModalStep = "search" | "config" | "suggest";

export type LibraryConfigValues = {
  pricePerMinuteLzt: number;
  appPath: string;
  boundUrl: string;
  launchArgs: string;
};

export function lztToUsd(lzt: number): string {
  return (lzt / LZT_PER_USD).toFixed(2);
}

export function resolveEntryKind(entry: LibraryEntryLike): LibraryEntryKind {
  return entry.boundUrl || entry.game.browserHostUrl ? "browser" : "native";
}

export function isWindowsPath(path: string): boolean {
  return /^[a-zA-Z]:\\/.test(path) || path.startsWith("\\\\") || path.startsWith("/");
}

export function validateLibraryAppPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (!isWindowsPath(trimmed)) {
    return "Путь должен выглядеть как C:\\path\\to\\game.exe или /path/to/binary";
  }
  return null;
}

export function parsePricePerMinuteLzt(price: string): number {
  return Math.max(0, parseInt(price, 10) || 0);
}

export function normalizeLibraryConfigValues(opts: {
  isBrowser: boolean;
  price: string;
  appPath: string;
  boundUrl: string;
  launchArgs: string;
}): { values: LibraryConfigValues; pathError: string | null } {
  const pathError = opts.isBrowser ? null : validateLibraryAppPath(opts.appPath);
  return {
    pathError,
    values: {
      pricePerMinuteLzt: parsePricePerMinuteLzt(opts.price),
      appPath: opts.isBrowser ? "" : opts.appPath.trim(),
      boundUrl: opts.isBrowser ? opts.boundUrl.trim() : "",
      launchArgs: opts.launchArgs.trim(),
    },
  };
}

export function isValidSteamAppId(id: string): boolean {
  return /^\d+$/.test(id.trim());
}

export function getAddModalTitle(step: AddModalStep, pendingSubmissionId: string | null): string {
  const titleMap: Record<AddModalStep, string> = {
    search: "Добавить игру в библиотеку",
    config: pendingSubmissionId ? "Настройка запуска (ожидает модерации)" : "Настройка запуска",
    suggest: "Предложить новую игру",
  };
  return titleMap[step];
}

export function buildCatalogSearchParams(query: string): { search?: string } {
  const trimmed = query.trim();
  return trimmed ? { search: trimmed } : {};
}

export function formatCatalogGameMeta(
  category?: string | null,
  genre?: string | null,
  genres?: string[] | null,
): string {
  return [category, genre, genres?.join(", ")].filter(Boolean).join(" · ") || "Без категории";
}

export function isBrowserCatalogGame(game: { browserHostUrl?: string | null }): boolean {
  return !!game.browserHostUrl;
}

export function resolveDeleteConflictStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status;
  }
  return 0;
}
