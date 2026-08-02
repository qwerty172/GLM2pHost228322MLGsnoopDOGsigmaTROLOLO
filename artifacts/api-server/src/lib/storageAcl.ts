const LEGACY_PUBLIC_COVER_PATH = /^\/objects\/uploads\/[^/]+$/;

/** Normalize client-facing storage paths to `/objects/...`. */
export function normalizeStorageObjectPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) return null;

  const withoutApiPrefix = trimmed.startsWith("/api/storage")
    ? trimmed.slice("/api/storage".length)
    : trimmed;

  if (!withoutApiPrefix.startsWith("/objects/")) {
    return null;
  }

  return withoutApiPrefix;
}

/** Legacy cover uploads without ACL metadata remain publicly readable. */
export function isLegacyPublicCoverObjectPath(objectPath: string): boolean {
  return LEGACY_PUBLIC_COVER_PATH.test(objectPath);
}
