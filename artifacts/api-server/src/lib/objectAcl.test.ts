import { describe, expect, it, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import {
  ObjectPermission,
  canAccessObject,
  type ObjectAclPolicy,
} from "./objectAcl";

function mockFile(aclPolicy: ObjectAclPolicy | null): File {
  const metadata =
    aclPolicy === null
      ? {}
      : { "custom:aclPolicy": JSON.stringify(aclPolicy) };
  return {
    getMetadata: vi.fn().mockResolvedValue([{ metadata }]),
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("denies read when ACL metadata is missing (legacy objects)", async () => {
    const file = mockFile(null);
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows public read without authentication", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies private read without userId", async () => {
    const file = mockFile({ owner: "player:1", visibility: "private" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("allows private read for owner", async () => {
    const file = mockFile({ owner: "player:42", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:42",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(true);
  });

  it("denies private read for non-owner", async () => {
    const file = mockFile({ owner: "player:42", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "player:99",
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      }),
    ).resolves.toBe(false);
  });

  it("denies public write for anonymous users", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    await expect(
      canAccessObject({
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).resolves.toBe(false);
  });

  it("allows write for owner on private object", async () => {
    const file = mockFile({ owner: "host:7", visibility: "private" });
    await expect(
      canAccessObject({
        userId: "host:7",
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      }),
    ).resolves.toBe(true);
  });
});
