import { describe, expect, it, vi } from "vitest";
import {
  ObjectPermission,
  canAccessObject,
  type ObjectAclPolicy,
} from "./objectAcl";

function mockFile(aclPolicy: ObjectAclPolicy | null) {
  return {
    getMetadata: vi.fn().mockResolvedValue([
      {
        metadata: aclPolicy
          ? { "custom:aclPolicy": JSON.stringify(aclPolicy) }
          : {},
      },
    ]),
  } as unknown as import("@google-cloud/storage").File;
}

describe("canAccessObject", () => {
  it("denies read when no ACL metadata (legacy public read closed)", async () => {
    const file = mockFile(null);
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows public read for visibility=public", async () => {
    const file = mockFile({ owner: "host:abc", visibility: "public" });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("allows owner read for visibility=private", async () => {
    const file = mockFile({ owner: "player:p1", visibility: "private" });
    expect(
      await canAccessObject({
        userId: "player:p1",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies non-owner read for visibility=private", async () => {
    const file = mockFile({ owner: "player:p1", visibility: "private" });
    expect(
      await canAccessObject({
        userId: "player:p2",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });
});
