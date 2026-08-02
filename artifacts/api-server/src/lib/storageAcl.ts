import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import type { ObjectAclPolicy } from "./objectAcl";

const API_OBJECTS_PREFIX = "/api/storage/objects/";

/** Parse `/api/storage/objects/...` or `/objects/...` into `/objects/...` entity path. */
export function parseStorageObjectEntityPath(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed.startsWith("/")) return null;

  if (trimmed.startsWith(API_OBJECTS_PREFIX)) {
    const rest = trimmed.slice(API_OBJECTS_PREFIX.length);
    return rest ? `/objects/${rest}` : null;
  }
  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }
  return null;
}

/** Apply ACL metadata when the path refers to a private object entity. */
export async function tryApplyObjectAclFromPath(
  urlOrPath: string,
  aclPolicy: ObjectAclPolicy,
): Promise<boolean> {
  const entityPath = parseStorageObjectEntityPath(urlOrPath);
  if (!entityPath) return false;

  const svc = new ObjectStorageService();
  try {
    await svc.trySetObjectEntityAclPolicy(entityPath, aclPolicy);
    return true;
  } catch (err) {
    logger.warn(
      { err, entityPath, visibility: aclPolicy.visibility },
      "Failed to set object ACL",
    );
    return false;
  }
}
