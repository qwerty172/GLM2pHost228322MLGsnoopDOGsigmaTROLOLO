import { describe, it, expect, vi } from "vitest";
import type { File } from "@google-cloud/storage";
import { ObjectPermission, canAccessObject } from "./objectAcl";

function mockFile(aclPolicy: Record<string, unknown> | null): File {
  const metadata = aclPolicy
    ? { metadata: { "custom:aclPolicy": JSON.stringify(aclPolicy) } }
    : {};
  return {
    getMetadata: vi.fn().mockResolvedValue([metadata]),
  } as unknown as File;
}

describe("canAccessObject", () => {
  it("allows anonymous READ for legacy objects without ACL metadata", async () => {
    const file = mockFile(null);
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(true);
  });

  it("denies WRITE for legacy objects without ACL metadata", async () => {
    const file = mockFile(null);
    const allowed = await canAccessObject({
      userId: "user-1",
      objectFile: file,
      requestedPermission: ObjectPermission.WRITE,
    });
    expect(allowed).toBe(false);
  });

  it("allows anonymous READ when visibility is public", async () => {
    const file = mockFile({ owner: "host:1", visibility: "public" });
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(true);
  });

  it("denies anonymous READ when visibility is private", async () => {
    const file = mockFile({ owner: "host:1", visibility: "private" });
    const allowed = await canAccessObject({
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(false);
  });

  it("allows owner READ on private objects", async () => {
    const file = mockFile({ owner: "host:42", visibility: "private" });
    const allowed = await canAccessObject({
      userId: "host:42",
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(true);
  });

  it("denies non-owner READ on private objects", async () => {
    const file = mockFile({ owner: "host:42", visibility: "private" });
    const allowed = await canAccessObject({
      userId: "host:99",
      objectFile: file,
      requestedPermission: ObjectPermission.READ,
    });
    expect(allowed).toBe(false);
  });
});
