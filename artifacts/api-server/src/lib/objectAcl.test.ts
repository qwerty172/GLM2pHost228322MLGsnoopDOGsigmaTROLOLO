import { describe, expect, it } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  type ObjectAclPolicy,
} from "./objectAcl";
import {
  objectPathFromCoverUrl,
  trySetCoverImagePublicAcl,
  trySetSavePrivateAcl,
} from "./storageAclHelpers";

function mockFile(aclPolicy: ObjectAclPolicy | null): File {
  return {
    name: "test-object",
    getMetadata: async () => [
      {
        metadata: aclPolicy
          ? { "custom:aclPolicy": JSON.stringify(aclPolicy) }
          : {},
      },
    ],
    exists: async () => [true],
    setMetadata: async () => [{}],
  } as unknown as File;
}

describe("objectAcl", () => {
  describe("getObjectAclPolicy", () => {
    it("returns null when metadata is absent", async () => {
      const file = mockFile(null);
      const policy = await getObjectAclPolicy(file);
      expect(policy).toBeNull();
    });

    it("parses stored ACL JSON", async () => {
      const file = mockFile({
        owner: "host:abc",
        visibility: "public",
      });
      const policy = await getObjectAclPolicy(file);
      expect(policy).toEqual({ owner: "host:abc", visibility: "public" });
    });
  });

  describe("canAccessObject", () => {
    it("denies access when no ACL policy exists (legacy public read closed)", async () => {
      const file = mockFile(null);
      const allowed = await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      expect(allowed).toBe(false);
    });

    it("allows public read without userId", async () => {
      const file = mockFile({
        owner: "host:abc",
        visibility: "public",
      });
      const allowed = await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      expect(allowed).toBe(true);
    });

    it("denies private read without userId", async () => {
      const file = mockFile({
        owner: "player:xyz",
        visibility: "private",
      });
      const allowed = await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      expect(allowed).toBe(false);
    });

    it("allows owner read on private object", async () => {
      const file = mockFile({
        owner: "player:xyz",
        visibility: "private",
      });
      const allowed = await canAccessObject({
        userId: "player:xyz",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      expect(allowed).toBe(true);
    });

    it("denies non-owner read on private object", async () => {
      const file = mockFile({
        owner: "player:xyz",
        visibility: "private",
      });
      const allowed = await canAccessObject({
        userId: "player:other",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      expect(allowed).toBe(false);
    });
  });
});

describe("storageAclHelpers", () => {
  describe("objectPathFromCoverUrl", () => {
    it("maps /api/storage/objects/ paths", () => {
      expect(
        objectPathFromCoverUrl("/api/storage/objects/uploads/abc.webp"),
      ).toBe("/objects/uploads/abc.webp");
    });

    it("passes through /objects/ paths", () => {
      expect(objectPathFromCoverUrl("/objects/uploads/abc.webp")).toBe(
        "/objects/uploads/abc.webp",
      );
    });

    it("returns null for external URLs", () => {
      expect(
        objectPathFromCoverUrl("https://cdn.example.com/cover.jpg"),
      ).toBeNull();
    });
  });

  it("exports ACL setters for cover and save flows", () => {
    expect(typeof trySetCoverImagePublicAcl).toBe("function");
    expect(typeof trySetSavePrivateAcl).toBe("function");
  });
});
