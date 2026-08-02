import type { ObjectAclPolicy } from "./objectAcl";
import { ObjectStorageService } from "./objectStorage";

/** Normalize coverImageUrl or API path to `/objects/...`, or null if not storage-backed. */
export function normalizeObjectEntityPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const apiPrefix = "/api/storage/objects/";
  if (trimmed.startsWith(apiPrefix)) {
    return `/objects/${trimmed.slice(apiPrefix.length)}`;
  }

  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }

  return null;
}

export async function trySetStorageObjectAcl(
  objectPath: string,
  aclPolicy: ObjectAclPolicy,
): Promise<boolean> {
  const storage = new ObjectStorageService();
  try {
    await storage.trySetObjectEntityAclPolicy(objectPath, aclPolicy);
    return true;
  } catch {
    return false;
  }
}
