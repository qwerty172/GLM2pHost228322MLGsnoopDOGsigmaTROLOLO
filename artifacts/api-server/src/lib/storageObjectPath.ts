const COVER_UPLOAD_PATH_RE = /^\/objects\/uploads\/[0-9a-f-]{36}$/i;

/** True only for presigned cover uploads under `/objects/uploads/{uuid}`. */
export function isCoverUploadObjectPath(objectPath: string): boolean {
  const normalized = normalizeStorageObjectPath(objectPath);
  return normalized != null && COVER_UPLOAD_PATH_RE.test(normalized);
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
