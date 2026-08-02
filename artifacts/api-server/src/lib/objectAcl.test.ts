import { describe, it, expect, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  canAccessObject,
  ObjectPermission,
  type ObjectAclPolicy,
} from "./objectAcl";
import {
  storageObjectPathFromCoverUrl,
  trySetCoverPublicAcl,
  trySetSavePrivateAcl,
} from "./storageAclHelpers";

function mockFile(aclPolicy: ObjectAclPolicy | null): File {
  return {
    getMetadata: vi.fn().mockResolvedValue([
      aclPolicy
        ? { metadata: { "custom:aclPolicy": JSON.stringify(aclPolicy) } }
        : { metadata: {} },
    ]),
    exists: vi.fn().mockResolvedValue([true]),
    setMetadata: vi.fn(),
    name: "test-object",
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("denies read when ACL metadata is missing (legacy public read closed)", async () => {
    const file = mockFile(null);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows anonymous read for visibility=public", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies anonymous read for visibility=private", async () => {
    const file = mockFile({ owner: "player:42", visibility: "private" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows owner read for visibility=private", async () => {
    const file = mockFile({ owner: "player:42", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:42",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies non-owner read for visibility=private", async () => {
    const file = mockFile({ owner: "player:42", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:99",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });
});

describe("storageObjectPathFromCoverUrl", () => {
  it("parses /api/storage/objects/ prefix", () => {
    expect(
      storageObjectPathFromCoverUrl("/api/storage/objects/uploads/abc-123"),
    ).toBe("/objects/uploads/abc-123");
  });

  it("accepts bare /objects/ paths", () => {
    expect(storageObjectPathFromCoverUrl("/objects/uploads/abc-123")).toBe(
      "/objects/uploads/abc-123",
    );
  });

  it("returns null for external http(s) URLs", () => {
    expect(
      storageObjectPathFromCoverUrl("https://cdn.example.com/cover.jpg"),
    ).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(storageObjectPathFromCoverUrl("")).toBeNull();
    expect(storageObjectPathFromCoverUrl("   ")).toBeNull();
  });
});

describe("storage ACL helpers", () => {
  it("sets public cover ACL with host owner", async () => {
    const trySet = vi.fn().mockResolvedValue("/objects/uploads/u1");
    const storage = { trySetObjectEntityAclPolicy: trySet } as never;

    await trySetCoverPublicAcl(
      storage,
      "/api/storage/objects/uploads/u1",
      "host-7",
    );

    expect(trySet).toHaveBeenCalledWith("/objects/uploads/u1", {
      owner: "host:host-7",
      visibility: "public",
    });
  });

  it("sets private save ACL with player owner", async () => {
    const trySet = vi.fn().mockResolvedValue("/objects/saves/p1/g1/save.zip");
    const storage = { trySetObjectEntityAclPolicy: trySet } as never;

    await trySetSavePrivateAcl(
      storage,
      "/objects/saves/p1/g1/save.zip",
      "p1",
    );

    expect(trySet).toHaveBeenCalledWith("/objects/saves/p1/g1/save.zip", {
      owner: "player:p1",
      visibility: "private",
    });
  });
});
