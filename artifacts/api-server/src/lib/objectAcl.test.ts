import { describe, expect, it, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";
import {
  ensureObjectAclFromUrl,
  parseStorageObjectPath,
} from "./storageAcl";

function mockFile(
  metadata: Record<string, string> | undefined,
  exists = true,
): File {
  return {
    getMetadata: vi.fn().mockResolvedValue([{ metadata }]),
    exists: vi.fn().mockResolvedValue([exists]),
    setMetadata: vi.fn().mockResolvedValue([]),
    name: "test-object",
  } as unknown as File;
}

const publicPolicy = {
  owner: "host:abc",
  visibility: "public" as const,
};

const privatePolicy = {
  owner: "player:xyz",
  visibility: "private" as const,
};

describe("getObjectAclPolicy", () => {
  it("returns null when ACL metadata is absent", async () => {
    const file = mockFile(undefined);
    await expect(getObjectAclPolicy(file)).resolves.toBeNull();
  });

  it("parses stored ACL JSON from custom metadata", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(publicPolicy),
    });
    await expect(getObjectAclPolicy(file)).resolves.toEqual(publicPolicy);
  });
});

describe("canAccessObject", () => {
  it("denies access when object has no ACL policy", async () => {
    const file = mockFile(undefined);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows anonymous READ on public objects", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(publicPolicy),
    });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies anonymous WRITE even when visibility is public", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(publicPolicy),
    });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).resolves.toBe(false);
  });

  it("denies anonymous READ on private objects", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(privatePolicy),
    });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows owner READ on private objects", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(privatePolicy),
    });
    await expect(
      canAccessObject({
        userId: "player:xyz",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("allows owner WRITE on private objects", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(privatePolicy),
    });
    await expect(
      canAccessObject({
        userId: "player:xyz",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).resolves.toBe(true);
  });

  it("denies non-owner READ on private objects", async () => {
    const file = mockFile({
      "custom:aclPolicy": JSON.stringify(privatePolicy),
    });
    await expect(
      canAccessObject({
        userId: "player:other",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });
});

describe("setObjectAclPolicy", () => {
  it("writes ACL JSON into object custom metadata", async () => {
    const file = mockFile(undefined);
    await setObjectAclPolicy(file, privatePolicy);
    expect(file.setMetadata).toHaveBeenCalledWith({
      metadata: {
        "custom:aclPolicy": JSON.stringify(privatePolicy),
      },
    });
  });

  it("throws when the target object does not exist", async () => {
    const file = mockFile(undefined, false);
    await expect(setObjectAclPolicy(file, privatePolicy)).rejects.toThrow(
      /Object not found/,
    );
  });
});

describe("parseStorageObjectPath", () => {
  it("normalizes /api/storage/objects/… paths", () => {
    expect(
      parseStorageObjectPath("/api/storage/objects/uploads/abc.png"),
    ).toBe("/objects/uploads/abc.png");
  });

  it("accepts canonical /objects/… paths", () => {
    expect(parseStorageObjectPath("/objects/saves/p/g/save.zip")).toBe(
      "/objects/saves/p/g/save.zip",
    );
  });

  it("returns null for external http(s) URLs", () => {
    expect(parseStorageObjectPath("https://cdn.example/cover.jpg")).toBeNull();
  });
});

describe("ensureObjectAclFromUrl", () => {
  it("skips non-storage URLs", async () => {
    const storage = {
      trySetObjectEntityAclPolicy: vi.fn(),
    };
    const ok = await ensureObjectAclFromUrl(
      "https://cdn.example/cover.jpg",
      publicPolicy,
      storage as never,
    );
    expect(ok).toBe(false);
    expect(storage.trySetObjectEntityAclPolicy).not.toHaveBeenCalled();
  });

  it("applies ACL for storage object paths", async () => {
    const storage = {
      trySetObjectEntityAclPolicy: vi.fn().mockResolvedValue("/objects/uploads/x"),
    };
    const ok = await ensureObjectAclFromUrl(
      "/api/storage/objects/uploads/x",
      publicPolicy,
      storage as never,
    );
    expect(ok).toBe(true);
    expect(storage.trySetObjectEntityAclPolicy).toHaveBeenCalledWith(
      "/objects/uploads/x",
      publicPolicy,
    );
  });
});
