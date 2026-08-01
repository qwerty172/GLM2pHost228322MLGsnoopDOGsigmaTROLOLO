import { describe, expect, it } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  canAccessObject,
  ObjectPermission,
  type ObjectAclPolicy,
} from "./objectAcl";
import { storageObjectPathFromClientUrl } from "./storageRouteHelpers";

function mockObjectFile(aclPolicy: ObjectAclPolicy | null): File {
  const metadata = aclPolicy
    ? { metadata: { "custom:aclPolicy": JSON.stringify(aclPolicy) } }
    : {};
  return {
    getMetadata: async () => [metadata],
    exists: async () => [true],
    name: "bucket/uploads/test-object",
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("denies access when ACL policy is missing (legacy objects)", async () => {
    const file = mockObjectFile(null);
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(false);
  });

  it("allows public READ without authentication", async () => {
    const file = mockObjectFile({
      owner: "host:abc",
      visibility: "public",
    });
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(true);
  });

  it("denies private READ without userId", async () => {
    const file = mockObjectFile({
      owner: "player:abc",
      visibility: "private",
    });
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(false);
  });

  it("allows private READ for owner", async () => {
    const file = mockObjectFile({
      owner: "player:abc",
      visibility: "private",
    });
    const allowed = await canAccessObject({
      userId: "player:abc",
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(true);
  });

  it("denies private READ for non-owner", async () => {
    const file = mockObjectFile({
      owner: "player:abc",
      visibility: "private",
    });
    const allowed = await canAccessObject({
      userId: "player:other",
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(false);
  });

  it("allows owner WRITE on private object", async () => {
    const file = mockObjectFile({
      owner: "host:host-1",
      visibility: "private",
    });
    const allowed = await canAccessObject({
      userId: "host:host-1",
      objectFile: file,
      requestedPermission: ObjectPermission.WRITE,
    });
    expect(allowed).toBe(true);
  });
});

describe("storageObjectPathFromClientUrl", () => {
  it("parses /api/storage/objects paths", () => {
    expect(
      storageObjectPathFromClientUrl("/api/storage/objects/uploads/uuid"),
    ).toBe("/objects/uploads/uuid");
  });

  it("accepts bare /objects paths", () => {
    expect(storageObjectPathFromClientUrl("/objects/saves/p/g/save.zip")).toBe(
      "/objects/saves/p/g/save.zip",
    );
  });

  it("returns null for external URLs", () => {
    expect(
      storageObjectPathFromClientUrl("https://example.com/cover.jpg"),
    ).toBeNull();
  });
});
