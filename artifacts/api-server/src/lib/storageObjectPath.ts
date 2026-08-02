/** Normalize cover/object paths to `/objects/...` for comparison. */
export function normalizeStorageObjectPath(raw: string): string {
  let path = raw.trim();
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "";
    }
  }

  if (path.startsWith("/api/storage/objects/")) {
    return `/objects/${path.slice("/api/storage/objects/".length)}`;
  }
  if (path.startsWith("api/storage/objects/")) {
    return `/objects/${path.slice("api/storage/objects/".length)}`;
  }
  if (path.startsWith("/objects/")) {
    return path;
  }
  if (path.startsWith("objects/")) {
    return `/${path}`;
  }

  return path;
}

export function coverUrlVariants(objectPath: string): string[] {
  const normalized = normalizeStorageObjectPath(objectPath);
  if (!normalized.startsWith("/objects/")) return [];

  return [
    normalized,
    `/api/storage${normalized}`,
    normalized.replace(/^\//, ""),
    `api/storage${normalized}`,
  ];
}
