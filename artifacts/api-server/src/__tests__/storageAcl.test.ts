import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allowsLegacyPublicRead,
  isLegacyPublicCoverPath,
} from "../lib/storageAcl.js";

describe("storageAcl", () => {
  it("treats uploads/* as legacy public cover paths", () => {
    assert.equal(isLegacyPublicCoverPath("uploads/abc-123"), true);
    assert.equal(isLegacyPublicCoverPath("uploads/nested/file.jpg"), true);
    assert.equal(isLegacyPublicCoverPath("saves/player/game/save.zip"), false);
    assert.equal(isLegacyPublicCoverPath("clips/foo.webm"), false);
  });

  it("allows legacy public read only for uploads/*", () => {
    assert.equal(allowsLegacyPublicRead("uploads/uuid"), true);
    assert.equal(allowsLegacyPublicRead("saves/p1/g1/save.zip"), false);
    assert.equal(allowsLegacyPublicRead("saves/p1/g1/v2.zip"), false);
  });
});
