import { describe, expect, it } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  type ObjectAclPolicy,
} from "./objectAcl";
import {
  normalizeObjectEntityPath,
} from "./storageAcl";

function mockFile(aclPolicy: ObjectAclPolicy | null): File {
  const metadata =
    aclPolicy === null
      ? { metadata: {} }
      : {
          metadata: {
            "custom:aclPolicy": JSON.stringify(aclPolicy),
          },
        };

  return {
    getMetadata: async () => [metadata],
    exists: async () => [true],
    name: "test-object",
  } as unknown as File;
}

describe("normalizeObjectEntityPath", () => {
  it("accepts /objects/ paths", () => {
    expect(normalizeObjectEntityPath("/objects/uploads/abc.jpg")).toBe(
      "/objects/uploads/abc.jpg",
    );
  });

  it("strips /api/storage prefix", () => {
    expect(
      normalizeObjectEntityPath("/api/storage/objects/uploads/abc.jpg"),
    ).toBe("/objects/uploads/abc.jpg");
  });

  it("returns null for external URLs", () => {
    expect(normalizeObjectEntityPath("https://cdn.example/cover.jpg")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(normalizeObjectEntityPath("")).toBeNull();
    expect(normalizeObjectEntityPath("   ")).toBeNull();
  });
});

describe("canAccessObject", () => {
  it("denies when ACL metadata is missing (legacy)", async () => {
    const file = mockFile(null);
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows public read without userId", async () => {
    const file = mockFile({
      owner: "host:1",
      visibility: "public",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies public read for write permission", async () => {
    const file = mockFile({
      owner: "host:1",
      visibility: "public",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });

  it("denies private read without userId", async () => {
    const file = mockFile({
      owner: "host:1",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows private read for owner", async () => {
    const file = mockFile({
      owner: "player:42",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "player:42",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies private read for non-owner", async () => {
    const file = mockFile({
      owner: "player:42",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "player:99",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows owner write on private object", async () => {
    const file = mockFile({
      owner: "host:7",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "host:7",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(true);
  });
});
