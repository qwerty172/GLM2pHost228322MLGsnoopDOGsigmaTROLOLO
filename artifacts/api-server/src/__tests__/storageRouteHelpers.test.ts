import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyPublicObjectPath,
  normalizeStorageObjectPath,
} from "../lib/storageRouteHelpers.js";

describe("normalizeStorageObjectPath", () => {
  it("strips /api/storage prefix", () => {
    assert.equal(
      normalizeStorageObjectPath("/api/storage/objects/uploads/abc"),
      "/objects/uploads/abc",
    );
  });

  it("keeps bare /objects paths", () => {
    assert.equal(
      normalizeStorageObjectPath("/objects/uploads/abc"),
      "/objects/uploads/abc",
    );
  });
});

describe("isLegacyPublicObjectPath", () => {
  it("allows cover uploads under /objects/uploads/", () => {
    assert.equal(isLegacyPublicObjectPath("/objects/uploads/deadbeef"), true);
    assert.equal(
      isLegacyPublicObjectPath("/api/storage/objects/uploads/deadbeef"),
      true,
    );
  });

  it("denies other paths without ACL", () => {
    assert.equal(
      isLegacyPublicObjectPath("/objects/saves/player/game/save.zip"),
      false,
    );
    assert.equal(isLegacyPublicObjectPath("/objects/clips/secret.webm"), false);
    assert.equal(
      isLegacyPublicObjectPath("/objects/uploads-evil/payload"),
      false,
    );
  });
});
