import { ObjectStorageService } from "./objectStorage";
import type { ObjectAclPolicy } from "./objectAcl";

const API_STORAGE_OBJECTS_PREFIX = "/api/storage/objects/";
const OBJECTS_PREFIX = "/objects/";

/** Map `/api/storage/objects/…` or `/objects/…` to a canonical `/objects/…` path. */
export function parseStorageObjectPath(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(API_STORAGE_OBJECTS_PREFIX)) {
    return `${OBJECTS_PREFIX}${trimmed.slice(API_STORAGE_OBJECTS_PREFIX.length)}`;
  }
  if (trimmed.startsWith(OBJECTS_PREFIX)) {
    return trimmed;
  }
  return null;
}

export async function ensureObjectAclFromUrl(
  urlOrPath: string,
  aclPolicy: ObjectAclPolicy,
  storage: ObjectStorageService = new ObjectStorageService(),
): Promise<boolean> {
  const objectPath = parseStorageObjectPath(urlOrPath);
  if (!objectPath) return false;

  try {
    await storage.trySetObjectEntityAclPolicy(objectPath, aclPolicy);
    return true;
  } catch {
    return false;
  }
}
