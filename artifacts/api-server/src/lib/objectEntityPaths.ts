/**
 * Parse API-facing storage paths into canonical /objects/... entity paths.
 * Accepts /api/storage/objects/... or /objects/...
 */
export function parseObjectEntityPathFromUrl(url: string): string | null {
  if (!url.startsWith("/")) return null;

  const apiPrefix = "/api/storage/objects/";
  if (url.startsWith(apiPrefix)) {
    return `/objects/${url.slice(apiPrefix.length)}`;
  }

  if (url.startsWith("/objects/")) {
    return url;
  }

  return null;
}
