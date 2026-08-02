import type { ObjectAclPolicy } from "./objectAcl";
import {
  ObjectStorageNotConfiguredError,
  ObjectStorageService,
} from "./objectStorage";

const objectStorageService = new ObjectStorageService();

/** Extract `/objects/...` from API paths or raw storage paths. */
export function parseStorageObjectPath(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const apiPrefix = "/api/storage/objects/";
  const idx = trimmed.indexOf(apiPrefix);
  if (idx !== -1) {
    const suffix = trimmed.slice(idx + apiPrefix.length);
    return suffix ? `/objects/${suffix}` : null;
  }

  if (trimmed.startsWith("/objects/")) {
    return trimmed;
  }

  return null;
}

export async function applyStorageObjectAcl(
  urlOrPath: string,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const objectPath = parseStorageObjectPath(urlOrPath);
  if (!objectPath) return;

  try {
    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, aclPolicy);
  } catch (error) {
    if (error instanceof ObjectStorageNotConfiguredError) {
      return;
    }
    throw error;
  }
}

export async function applyCoverImageAcl(
  coverImageUrl: string,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  if (!coverImageUrl || coverImageUrl.startsWith("http")) return;
  await applyStorageObjectAcl(coverImageUrl, aclPolicy);
}
