import type { File } from "@google-cloud/storage";
import type { Request } from "express";
import { getObjectAclPolicy, ObjectPermission } from "./objectAcl";
import type { ObjectStorageService } from "./objectStorage";
import { resolveCallerUserId } from "./storageRouteHelpers";

export type ObjectReadAccessResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 };

/** Enforce ACL for GET /storage/objects/* — objects without metadata are denied. */
export async function enforceObjectReadAccess(
  req: Request,
  objectFile: File,
  objectStorageService: ObjectStorageService,
): Promise<ObjectReadAccessResult> {
  const policy = await getObjectAclPolicy(objectFile);
  if (!policy) {
    return { allowed: false, status: 403 };
  }

  const userId = await resolveCallerUserId(req);
  const canAccess = await objectStorageService.canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission: ObjectPermission.READ,
  });
  if (!canAccess) {
    return { allowed: false, status: userId ? 403 : 401 };
  }

  return { allowed: true };
}
