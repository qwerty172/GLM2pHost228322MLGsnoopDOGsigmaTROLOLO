import { ObjectStorageService } from "./objectStorage";

const objectStorageService = new ObjectStorageService();

/** Map `/api/storage/objects/…` or `/objects/…` cover paths to entity paths. */
export function objectPathFromCoverUrl(coverImageUrl: string): string | null {
  if (!coverImageUrl) return null;
  const apiPrefix = "/api/storage/objects/";
  const objectsPrefix = "/objects/";
  if (coverImageUrl.startsWith(apiPrefix)) {
    return `/objects/${coverImageUrl.slice(apiPrefix.length)}`;
  }
  if (coverImageUrl.startsWith(objectsPrefix)) {
    return coverImageUrl;
  }
  return null;
}

export async function trySetCoverImagePublicAcl(
  coverImageUrl: string,
  ownerHostId: string,
): Promise<void> {
  const objectPath = objectPathFromCoverUrl(coverImageUrl);
  if (!objectPath) return;
  await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
    owner: `host:${ownerHostId}`,
    visibility: "public",
  });
}

export async function trySetSavePrivateAcl(
  objectPath: string,
  playerId: string,
): Promise<void> {
  await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
    owner: `player:${playerId}`,
    visibility: "private",
  });
}
