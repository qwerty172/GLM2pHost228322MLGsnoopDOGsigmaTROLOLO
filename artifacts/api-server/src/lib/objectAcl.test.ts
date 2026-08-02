import { describe, expect, it, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  canAccessObject,
  ObjectPermission,
  type ObjectAclPolicy,
} from "./objectAcl";
import { extractObjectEntityPath } from "./storageRouteHelpers";

function mockFileWithPolicy(policy: ObjectAclPolicy | null): File {
  return {
    getMetadata: vi.fn().mockResolvedValue([
      {
        metadata: policy
          ? { "custom:aclPolicy": JSON.stringify(policy) }
          : {},
      },
    ]),
    exists: vi.fn().mockResolvedValue([true]),
    setMetadata: vi.fn().mockResolvedValue(undefined),
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("denies read when no ACL policy is set", async () => {
    const file = mockFileWithPolicy(null);
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows anonymous read for public objects", async () => {
    const file = mockFileWithPolicy({
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

  it("denies write on public objects for non-owners", async () => {
    const file = mockFileWithPolicy({
      owner: "host:abc",
      visibility: "public",
    });
    expect(
      await canAccessObject({
        userId: "host:xyz",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });

  it("denies private read without authentication", async () => {
    const file = mockFileWithPolicy({
      owner: "player:1",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows private read for the owner", async () => {
    const file = mockFileWithPolicy({
      owner: "player:1",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "player:1",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(true);
  });

  it("denies private read for a different user", async () => {
    const file = mockFileWithPolicy({
      owner: "player:1",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "player:2",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).toBe(false);
  });

  it("allows owner write on private objects", async () => {
    const file = mockFileWithPolicy({
      owner: "host:42",
      visibility: "private",
    });
    expect(
      await canAccessObject({
        userId: "host:42",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(true);
  });

  it("denies owner write when policy is missing", async () => {
    const file = mockFileWithPolicy(null);
    expect(
      await canAccessObject({
        userId: "host:42",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).toBe(false);
  });
});

describe("extractObjectEntityPath", () => {
  it("normalizes /api/storage/objects paths", () => {
    expect(
      extractObjectEntityPath("/api/storage/objects/uploads/abc"),
    ).toBe("/objects/uploads/abc");
  });

  it("passes through /objects paths unchanged", () => {
    expect(extractObjectEntityPath("/objects/saves/p/g/save.zip")).toBe(
      "/objects/saves/p/g/save.zip",
    );
  });

  it("returns null for external URLs", () => {
    expect(
      extractObjectEntityPath("https://cdn.example.com/cover.jpg"),
    ).toBeNull();
  });
});
