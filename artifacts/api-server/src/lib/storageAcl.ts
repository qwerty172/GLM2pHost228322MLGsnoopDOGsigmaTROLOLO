/**
 * Object-storage ACL helpers for GET /storage/objects/*.
 *
 * Legacy cover uploads (POST /storage/uploads/request-url) land under
 * `uploads/<uuid>` without custom:aclPolicy metadata. Those objects were
 * intentionally world-readable. Newer paths (saves, clips) must have ACL or
 * be denied.
 */

/** Entity id relative to PRIVATE_OBJECT_DIR (no `/objects/` prefix). */
export function isLegacyPublicCoverPath(entityId: string): boolean {
  return entityId.startsWith("uploads/");
}

/** True when an object without ACL metadata may still be served publicly. */
export function allowsLegacyPublicRead(entityId: string): boolean {
  return isLegacyPublicCoverPath(entityId);
}
