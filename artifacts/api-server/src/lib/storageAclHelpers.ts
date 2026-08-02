import { ObjectStorageService } from "./objectStorage";

/** Normalize client cover URL to `/objects/...` path, or null if not storage-backed. */
export function storageObjectPathFromCoverUrl(coverUrl: string): string | null {
  const trimmed = coverUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/storage/objects/")) {
    return `/objects/${trimmed.slice("/api/storage/objects/".length)}`;
  }
  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }
  return null;
}

export async function trySetCoverPublicAcl(
  storage: ObjectStorageService,
  coverUrl: string,
  hostId: string,
): Promise<void> {
  const objectPath = storageObjectPathFromCoverUrl(coverUrl);
  if (!objectPath) return;
  await storage.trySetObjectEntityAclPolicy(objectPath, {
    owner: `host:${hostId}`,
    visibility: "public",
  });
}

export async function trySetSavePrivateAcl(
  storage: ObjectStorageService,
  objectPath: string,
  playerId: string,
): Promise<void> {
  const normalized = objectPath.startsWith("/objects/")
    ? objectPath
    : `/objects/${objectPath.replace(/^\//, "")}`;
  await storage.trySetObjectEntityAclPolicy(normalized, {
    owner: `player:${playerId}`,
    visibility: "private",
  });
}
