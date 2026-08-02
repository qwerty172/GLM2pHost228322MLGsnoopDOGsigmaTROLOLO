const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalize client-facing storage paths to `/objects/...`. */
export function normalizeStorageObjectPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }

  const apiPrefix = "/api/storage/objects/";
  if (trimmed.startsWith(apiPrefix)) {
    return `/objects/${trimmed.slice(apiPrefix.length)}`;
  }

  return null;
}

/**
 * Legacy covers uploaded before ACL metadata existed live under
 * `/objects/uploads/{uuid}` and remain publicly readable without auth.
 */
export function isLegacyPublicUploadPath(objectPath: string): boolean {
  const normalized = normalizeStorageObjectPath(objectPath);
  if (!normalized) return false;

  const suffix = normalized.slice("/objects/uploads/".length);
  if (!suffix || suffix.includes("/")) return false;

  return UUID_RE.test(suffix);
}
