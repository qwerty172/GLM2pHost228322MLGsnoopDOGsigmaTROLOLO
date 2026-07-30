import type { File } from "@google-cloud/storage";
import { describe, expect, it, vi } from "vitest";
import {
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
} from "./objectAcl";

function mockFile(metadata: Record<string, string> | undefined): File {
  return {
    getMetadata: vi.fn().mockResolvedValue([{ metadata }]),
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("allows anonymous READ when no ACL metadata (legacy covers)", async () => {
    const file = mockFile(undefined);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies WRITE when no ACL metadata", async () => {
    const file = mockFile(undefined);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).resolves.toBe(false);
  });

  it("allows anonymous READ for visibility=public", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify({
        owner: "host:1",
        visibility: "public",
      }),
    });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies anonymous READ for visibility=private", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify({
        owner: "player:42",
        visibility: "private",
      }),
    });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows owner READ for visibility=private", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify({
        owner: "player:42",
        visibility: "private",
      }),
    });
    await expect(
      canAccessObject({
        userId: "player:42",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });
});

describe("getObjectAclPolicy", () => {
  it("returns null when metadata key is absent", async () => {
    const file = mockFile({});
    await expect(getObjectAclPolicy(file)).resolves.toBeNull();
  });
});
