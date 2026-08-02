/** UUID v4 object id under /objects/uploads/{id} — legacy cover uploads without ACL metadata. */
const LEGACY_UPLOAD_PATH_RE =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Wildcard segment from GET /storage/objects/* (no leading slash). */
export function isLegacyPublicUploadPath(wildcardPath: string): boolean {
  return LEGACY_UPLOAD_PATH_RE.test(wildcardPath);
}

/** Normalize client objectPath (/api/storage/objects/… or /objects/…) to /objects/…. */
export function normalizeStorageObjectPath(input: string): string {
  let path = input.trim();
  if (path.startsWith("/api/storage")) {
    path = path.slice("/api/storage".length);
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  if (!path.startsWith("/objects/")) {
    path = `/objects/${path.replace(/^\//, "")}`;
  }
  return path;
}
