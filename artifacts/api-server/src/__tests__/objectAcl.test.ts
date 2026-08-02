import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateObjectAccess,
  ObjectPermission,
  type ObjectAclPolicy,
} from "../lib/objectAcl.js";
import { parseStorageObjectPath } from "../lib/storageAclHelpers.js";

const privatePolicy: ObjectAclPolicy = {
  owner: "host:abc",
  visibility: "private",
};

const publicPolicy: ObjectAclPolicy = {
  owner: "host:abc",
  visibility: "public",
};

describe("evaluateObjectAccess", () => {
  it("denies access when ACL policy is missing", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: null,
        requestedPermission: ObjectPermission.READ,
      }),
      false,
    );
  });

  it("allows anonymous read on public objects", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: publicPolicy,
        requestedPermission: ObjectPermission.READ,
      }),
      true,
    );
  });

  it("denies anonymous write even on public objects", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: publicPolicy,
        requestedPermission: ObjectPermission.WRITE,
      }),
      false,
    );
  });

  it("denies anonymous read on private objects", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: privatePolicy,
        requestedPermission: ObjectPermission.READ,
      }),
      false,
    );
  });

  it("allows owner read on private objects", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: privatePolicy,
        userId: "host:abc",
        requestedPermission: ObjectPermission.READ,
      }),
      true,
    );
  });

  it("denies non-owner read on private objects", () => {
    assert.equal(
      evaluateObjectAccess({
        aclPolicy: privatePolicy,
        userId: "host:other",
        requestedPermission: ObjectPermission.READ,
      }),
      false,
    );
  });
});

describe("parseStorageObjectPath", () => {
  it("parses API and raw object paths", () => {
    assert.equal(
      parseStorageObjectPath("/api/storage/objects/uploads/cover.webp"),
      "/objects/uploads/cover.webp",
    );
    assert.equal(
      parseStorageObjectPath("/objects/saves/p1/g1/save.zip"),
      "/objects/saves/p1/g1/save.zip",
    );
    assert.equal(parseStorageObjectPath("https://cdn.example/cover.jpg"), null);
  });
});
