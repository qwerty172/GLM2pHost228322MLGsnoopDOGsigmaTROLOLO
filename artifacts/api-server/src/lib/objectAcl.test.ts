import { describe, expect, it, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
} from "./objectAcl";

const ACL_KEY = "custom:aclPolicy";

function mockFile(aclPolicy: object | null): File {
  return {
    getMetadata: vi.fn().mockResolvedValue([
      {
        metadata: aclPolicy
          ? { [ACL_KEY]: JSON.stringify(aclPolicy) }
          : {},
      },
    ]),
  } as unknown as File;
}

describe("getObjectAclPolicy", () => {
  it("returns null when metadata is missing", async () => {
    const file = mockFile(null);
    await expect(getObjectAclPolicy(file)).resolves.toBeNull();
  });

  it("parses stored ACL JSON", async () => {
    const file = mockFile({ owner: "host:1", visibility: "private" });
    await expect(getObjectAclPolicy(file)).resolves.toEqual({
      owner: "host:1",
      visibility: "private",
    });
  });
});

describe("canAccessObject", () => {
  it("denies access when no ACL policy exists", async () => {
    const file = mockFile(null);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows public READ without authentication", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies private READ without userId", async () => {
    const file = mockFile({ owner: "player:abc", visibility: "private" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows owner READ on private objects", async () => {
    const file = mockFile({ owner: "player:abc", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:abc",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies non-owner READ on private objects", async () => {
    const file = mockFile({ owner: "player:abc", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:xyz",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });
});
