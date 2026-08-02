const COVER_UPLOAD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for presigned cover uploads: `/objects/uploads/{uuid}` only. */
export function isCoverUploadObjectPath(urlOrPath: string): boolean {
  const normalized = normalizeStorageObjectPath(urlOrPath);
  if (!normalized?.startsWith("/objects/uploads/")) return false;

  const suffix = normalized.slice("/objects/uploads/".length);
  if (!suffix || suffix.includes("/")) return false;

  return COVER_UPLOAD_UUID_RE.test(suffix);
}

/** Normalize client-facing storage paths to `/objects/...` form. */
export function normalizeStorageObjectPath(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "");
  const pathOnly = withoutOrigin.split("?")[0] ?? withoutOrigin;

  const objectsIdx = pathOnly.indexOf("/objects/");
  if (objectsIdx === -1) return null;

  const suffix = pathOnly.slice(objectsIdx + "/objects/".length);
  if (!suffix || suffix.includes("..")) return null;

  return `/objects/${suffix}`;
}
