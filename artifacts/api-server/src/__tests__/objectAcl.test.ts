import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLegacyPublicCoverObjectPath } from "../lib/objectAcl.js";

describe("isLegacyPublicCoverObjectPath", () => {
  it("allows flat cover upload paths", () => {
    assert.equal(
      isLegacyPublicCoverObjectPath(
        "/objects/uploads/550e8400-e29b-41d4-a716-446655440000",
      ),
      true,
    );
    assert.equal(isLegacyPublicCoverObjectPath("/objects/uploads/legacy-cover.jpg"), true);
  });

  it("denies saves, nested paths, and traversal", () => {
    assert.equal(
      isLegacyPublicCoverObjectPath("/objects/saves/player/game/save.zip"),
      false,
    );
    assert.equal(
      isLegacyPublicCoverObjectPath("/objects/uploads/nested/file.jpg"),
      false,
    );
    assert.equal(isLegacyPublicCoverObjectPath("/objects/uploads/../saves/x"), false);
    assert.equal(isLegacyPublicCoverObjectPath("/objects/clips/clip.webm"), false);
  });
});
