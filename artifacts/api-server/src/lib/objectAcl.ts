import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

// Can be flexibly defined according to the use case.
//
// Examples:
// - USER_LIST: the users from a list stored in the database;
// - EMAIL_DOMAIN: the users whose email is in a specific domain;
// - GROUP_MEMBER: the users who are members of a specific group;
// - SUBSCRIBER: the users who are subscribers of a specific service / content
//   creator.
export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  // The logic id that identifies qualified group members. Format depends on the
  // ObjectAccessGroupType — e.g. a user-list DB id, an email domain, a group id.
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

// Stored as object custom metadata under "custom:aclPolicy" (JSON string).
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    // Implement per access group type, e.g.:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }

  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy as string);
}

/** Legacy covers uploaded before ACL metadata existed live under uploads/*. */
export function isLegacyPublicObjectPath(objectPath: string): boolean {
  const relative = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.startsWith("objects/")
      ? objectPath.slice("objects/".length)
      : objectPath;
  return relative.startsWith("uploads/");
}

export type ObjectReadAccessResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 };

/** Pure decision logic — used by evaluateObjectReadAccess and unit tests. */
export function decideObjectReadAccess({
  objectPath,
  policy,
  canAccess,
  userId,
}: {
  objectPath: string;
  policy: ObjectAclPolicy | null;
  canAccess: boolean;
  userId?: string;
}): ObjectReadAccessResult {
  if (policy) {
    if (!canAccess) {
      return { allowed: false, status: userId ? 403 : 401 };
    }
    return { allowed: true };
  }

  if (isLegacyPublicObjectPath(objectPath)) {
    return { allowed: true };
  }

  return { allowed: false, status: 401 };
}

/**
 * Decide whether an object may be served via GET /storage/objects/*.
 * - ACL present → enforce canAccessObject
 * - No ACL + uploads/* → legacy public read
 * - No ACL + anything else → 401
 */
export async function evaluateObjectReadAccess({
  objectPath,
  objectFile,
  userId,
}: {
  objectPath: string;
  objectFile: File;
  userId?: string;
}): Promise<ObjectReadAccessResult> {
  const policy = await getObjectAclPolicy(objectFile);
  const canAccess = policy
    ? await canAccessObject({
        userId,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      })
    : false;
  return decideObjectReadAccess({ objectPath, policy, canAccess, userId });
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
