import { describe, expect, it } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  type ObjectAclPolicy,
} from "./objectAcl";
import {
  isPrivateObjectPath,
  toObjectEntityPath,
} from "./storageAclHelpers";

function mockFile(aclPolicy: ObjectAclPolicy | null): File {
  const metadata = aclPolicy
    ? { metadata: { "custom:aclPolicy": JSON.stringify(aclPolicy) } }
    : { metadata: {} };
  return {
    getMetadata: async () => [metadata],
  } as unknown as File;
}

describe("objectAcl canAccessObject", () => {
  it("denies read when no ACL metadata (legacy objects)", async () => {
    const file = mockFile(null);
    expect(await canAccessObject({ objectFile: file, requestedPermission: ObjectPermission.READ })).toBe(
      false,
    );
  });

  it("allows public read without userId", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies private read without userId", async () => {
    const file = mockFile({ owner: "host:1", visibility: "private" });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows private read for owner", async () => {
    const file = mockFile({ owner: "player:abc", visibility: "private" });
    expect(
      await canAccessObject({
        userId: "player:abc",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies private read for non-owner", async () => {
    const file = mockFile({ owner: "player:abc", visibility: "private" });
    expect(
      await canAccessObject({
        userId: "player:other",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("denies public write for non-owner", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    expect(
      await canAccessObject({
        userId: "host:2",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });

  it("allows write for owner on private object", async () => {
    const file = mockFile({ owner: "host:1", visibility: "private" });
    expect(
      await canAccessObject({
        userId: "host:1",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(true);
  });
});

describe("storageAclHelpers path parsing", () => {
  it("detects private object paths", () => {
    expect(isPrivateObjectPath("/api/storage/objects/uploads/uuid")).toBe(true);
    expect(isPrivateObjectPath("/objects/saves/p/g/save.zip")).toBe(true);
    expect(isPrivateObjectPath("/api/storage/public-objects/cover.jpg")).toBe(false);
    expect(isPrivateObjectPath("https://example.com/img.png")).toBe(false);
  });

  it("normalizes API and raw object paths", () => {
    expect(toObjectEntityPath("/api/storage/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
    expect(toObjectEntityPath("/objects/saves/p1/g1/save.zip")).toBe(
      "/objects/saves/p1/g1/save.zip",
    );
    expect(toObjectEntityPath("https://cdn.example.com/cover.jpg")).toBeNull();
  });
});
