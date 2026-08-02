import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideObjectReadAccess,
  toStorageApiPath,
} from "../lib/storageAclHelpers.js";

describe("toStorageApiPath", () => {
  it("prefixes /api/storage for object paths", () => {
    assert.equal(
      toStorageApiPath("/objects/covers/abc.webp"),
      "/api/storage/objects/covers/abc.webp",
    );
  });
});

describe("decideObjectReadAccess", () => {
  it("uses ACL when metadata exists", () => {
    assert.deepEqual(decideObjectReadAccess(true, false), { kind: "acl-check" });
    assert.deepEqual(decideObjectReadAccess(true, true), { kind: "acl-check" });
  });

  it("allows legacy public read only for catalog covers", () => {
    assert.deepEqual(decideObjectReadAccess(false, true), { kind: "legacy-public" });
  });

  it("denies objects without ACL that are not catalog covers", () => {
    assert.deepEqual(decideObjectReadAccess(false, false), { kind: "deny" });
  });
});
