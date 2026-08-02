import { describe, it, expect, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  type ObjectAclPolicy,
} from "./objectAcl";
import { parseStorageObjectEntityPath } from "./storageAcl";

function mockFile(policy: ObjectAclPolicy | null): File {
  const metadata =
    policy === null
      ? {}
      : { metadata: { "custom:aclPolicy": JSON.stringify(policy) } };
  return {
    getMetadata: vi.fn().mockResolvedValue([metadata]),
    exists: vi.fn().mockResolvedValue([true]),
    setMetadata: vi.fn().mockResolvedValue([]),
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("denies when no ACL metadata (legacy public read closed)", async () => {
    const file = mockFile(null);
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows public READ without userId", async () => {
    const file = mockFile({
      owner: "host:abc",
      visibility: "public",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies private READ without userId", async () => {
    const file = mockFile({
      owner: "player:abc",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows private READ for owner", async () => {
    const file = mockFile({
      owner: "player:abc",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "player:abc",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies WRITE on public visibility", async () => {
    const file = mockFile({
      owner: "host:abc",
      visibility: "public",
    });
    expect(
      await canAccessObject({
        userId: "host:abc",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(true);
    expect(
      await canAccessObject({
        userId: "host:other",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });
});

describe("parseStorageObjectEntityPath", () => {
  it("parses API-facing paths", () => {
    expect(
      parseStorageObjectEntityPath("/api/storage/objects/uploads/uuid"),
    ).toBe("/objects/uploads/uuid");
  });

  it("accepts entity paths", () => {
    expect(parseStorageObjectEntityPath("/objects/saves/p/g/save.zip")).toBe(
      "/objects/saves/p/g/save.zip",
    );
  });

  it("returns null for external URLs", () => {
    expect(
      parseStorageObjectEntityPath("https://example.com/cover.jpg"),
    ).toBeNull();
  });
});
