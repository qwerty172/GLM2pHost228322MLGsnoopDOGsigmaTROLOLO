import type { File } from "@google-cloud/storage";
import { ObjectPermission, getObjectAclPolicy } from "./objectAcl";
import type { ObjectStorageService } from "./objectStorage";

/** `/objects/...` → `/api/storage/objects/...` */
export function toStorageApiPath(rawObjectPath: string): string {
  const normalized = rawObjectPath.startsWith("/") ? rawObjectPath : `/${rawObjectPath}`;
  return `/api/storage${normalized}`;
}

export type ObjectReadDecision =
  | { kind: "acl-check" }
  | { kind: "legacy-public" }
  | { kind: "deny" };

/**
 * Legacy objects without ACL metadata were world-readable. We now only allow
 * that for covers referenced in the public games catalog.
 */
export function decideObjectReadAccess(
  hasAclPolicy: boolean,
  isCatalogCover: boolean,
): ObjectReadDecision {
  if (hasAclPolicy) return { kind: "acl-check" };
  if (isCatalogCover) return { kind: "legacy-public" };
  return { kind: "deny" };
}

export async function isLegacyCatalogCover(apiPath: string): Promise<boolean> {
  const { db, gamesTable, gameSubmissionsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const [game] = await db
    .select({ id: gamesTable.id })
    .from(gamesTable)
    .where(eq(gamesTable.coverImageUrl, apiPath))
    .limit(1);
  if (game) return true;

  const [submission] = await db
    .select({ id: gameSubmissionsTable.id })
    .from(gameSubmissionsTable)
    .where(eq(gameSubmissionsTable.coverImageUrl, apiPath))
    .limit(1);
  return Boolean(submission);
}

export async function canReadStorageObject({
  objectFile,
  objectPath,
  userId,
  objectStorageService,
}: {
  objectFile: File;
  objectPath: string;
  userId?: string;
  objectStorageService: ObjectStorageService;
}): Promise<boolean> {
  const policy = await getObjectAclPolicy(objectFile);
  const decision = decideObjectReadAccess(
    Boolean(policy),
    policy ? false : await isLegacyCatalogCover(toStorageApiPath(objectPath)),
  );

  if (decision.kind === "legacy-public") return true;
  if (decision.kind === "deny") return false;

  return objectStorageService.canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission: ObjectPermission.READ,
  });
}
