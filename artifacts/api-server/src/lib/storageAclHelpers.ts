import { ObjectStorageService } from "./objectStorage";
import type { ObjectAclPolicy } from "./objectAcl";

const objectStorageService = new ObjectStorageService();

/** True when path/URL refers to a private object entity (not public-objects). */
export function isPrivateObjectPath(path: string): boolean {
  const p = path.trim();
  return p.includes("/objects/") && !p.includes("/public-objects/");
}

/** Normalize `/api/storage/objects/…` or `/objects/…` to `/objects/…`. */
export function toObjectEntityPath(path: string): string | null {
  let rest = path.trim();
  if (rest.startsWith("/api/storage")) {
    rest = rest.slice("/api/storage".length);
  }
  if (!rest.startsWith("/objects/")) return null;
  return rest;
}

export async function tryApplyObjectAcl(
  path: string,
  policy: ObjectAclPolicy,
  log?: { warn: (obj: Record<string, unknown>, msg: string) => void },
): Promise<void> {
  const entityPath = toObjectEntityPath(path);
  if (!entityPath) return;
  try {
    await objectStorageService.trySetObjectEntityAclPolicy(entityPath, policy);
  } catch (err) {
    if (log) log.warn({ err }, "Failed to set object ACL");
  }
}
