import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request } from "express";
import type { File } from "@google-cloud/storage";
import { ObjectPermission } from "./objectAcl";
import { enforceObjectReadAccess } from "./storageObjectAccess";
import type { ObjectStorageService } from "./objectStorage";

vi.mock("./objectAcl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./objectAcl")>();
  return {
    ...actual,
    getObjectAclPolicy: vi.fn(),
  };
});

vi.mock("./storageRouteHelpers", () => ({
  resolveCallerUserId: vi.fn(),
}));

import { getObjectAclPolicy } from "./objectAcl";
import { resolveCallerUserId } from "./storageRouteHelpers";

const mockFile = {} as File;

function fakeReq(): Request {
  return { headers: {} } as Request;
}

describe("enforceObjectReadAccess", () => {
  const canAccessObjectEntity = vi.fn();
  const objectStorageService = {
    canAccessObjectEntity,
  } as unknown as ObjectStorageService;

  beforeEach(() => {
    vi.mocked(getObjectAclPolicy).mockReset();
    vi.mocked(resolveCallerUserId).mockReset();
    canAccessObjectEntity.mockReset();
  });

  it("denies when object has no ACL metadata (legacy bypass closed)", async () => {
    vi.mocked(getObjectAclPolicy).mockResolvedValue(null);

    const result = await enforceObjectReadAccess(fakeReq(), mockFile, objectStorageService);

    expect(result).toEqual({ allowed: false, status: 403 });
    expect(canAccessObjectEntity).not.toHaveBeenCalled();
  });

  it("allows public read without caller identity", async () => {
    vi.mocked(getObjectAclPolicy).mockResolvedValue({
      owner: "host:abc",
      visibility: "public",
    });
    vi.mocked(resolveCallerUserId).mockResolvedValue(undefined);
    canAccessObjectEntity.mockResolvedValue(true);

    const result = await enforceObjectReadAccess(fakeReq(), mockFile, objectStorageService);

    expect(result).toEqual({ allowed: true });
    expect(canAccessObjectEntity).toHaveBeenCalledWith({
      userId: undefined,
      objectFile: mockFile,
      requestedPermission: ObjectPermission.READ,
    });
  });

  it("returns 401 for anonymous private object access", async () => {
    vi.mocked(getObjectAclPolicy).mockResolvedValue({
      owner: "player:abc",
      visibility: "private",
    });
    vi.mocked(resolveCallerUserId).mockResolvedValue(undefined);
    canAccessObjectEntity.mockResolvedValue(false);

    const result = await enforceObjectReadAccess(fakeReq(), mockFile, objectStorageService);

    expect(result).toEqual({ allowed: false, status: 401 });
  });

  it("returns 403 when authenticated caller lacks permission", async () => {
    vi.mocked(getObjectAclPolicy).mockResolvedValue({
      owner: "player:abc",
      visibility: "private",
    });
    vi.mocked(resolveCallerUserId).mockResolvedValue("player:other");
    canAccessObjectEntity.mockResolvedValue(false);

    const result = await enforceObjectReadAccess(fakeReq(), mockFile, objectStorageService);

    expect(result).toEqual({ allowed: false, status: 403 });
  });
});
