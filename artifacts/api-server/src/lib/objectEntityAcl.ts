import type { ObjectStorageService } from "./objectStorage";
import { parseObjectEntityPathFromUrl } from "./objectEntityPaths";

/** Mark a cover image object as publicly readable (game catalog). */
export async function tryApplyCoverPublicAcl(
  storage: ObjectStorageService,
  coverImageUrl: string,
  ownerUserId: string,
): Promise<void> {
  const objectPath = parseObjectEntityPathFromUrl(coverImageUrl);
  if (!objectPath) return;

  try {
    await storage.trySetObjectEntityAclPolicy(objectPath, {
      owner: ownerUserId,
      visibility: "public",
    });
  } catch {
    // Cover may be external URL or object not yet uploaded — non-fatal.
  }
}

/** Mark a player save archive as private to the owning player. */
export async function tryApplySavePrivateAcl(
  storage: ObjectStorageService,
  objectPath: string,
  playerId: string,
): Promise<void> {
  try {
    await storage.trySetObjectEntityAclPolicy(objectPath, {
      owner: `player:${playerId}`,
      visibility: "private",
    });
  } catch {
    // Save object may not exist yet in storage — confirm/commit already verified.
  }
}
