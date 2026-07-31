/** Map a stored cover URL to the internal `/objects/...` path, if applicable. */
export function coverUrlToObjectPath(coverImageUrl: string): string | null {
  const trimmed = coverImageUrl.trim();
  if (!trimmed) return null;

  const apiPrefix = "/api/storage/objects/";
  if (trimmed.startsWith(apiPrefix)) {
    return `/objects/${trimmed.slice(apiPrefix.length)}`;
  }

  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }

  return null;
}
