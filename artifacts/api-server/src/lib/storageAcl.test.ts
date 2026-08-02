import { describe, expect, it } from "vitest";
import {
  isLegacyPublicUploadPath,
  normalizeStorageObjectPath,
} from "./storageAcl";

describe("isLegacyPublicUploadPath", () => {
  it("accepts uploads/{uuid} cover paths", () => {
    expect(
      isLegacyPublicUploadPath("uploads/550e8400-e29b-41d4-a716-446655440000"),
    ).toBe(true);
  });

  it("rejects saves and arbitrary paths", () => {
    expect(isLegacyPublicUploadPath("saves/player-1/game-1/save.zip")).toBe(false);
    expect(isLegacyPublicUploadPath("uploads/not-a-uuid")).toBe(false);
    expect(isLegacyPublicUploadPath("secrets/leak.txt")).toBe(false);
  });
});

describe("normalizeStorageObjectPath", () => {
  it("strips /api/storage prefix", () => {
    expect(
      normalizeStorageObjectPath(
        "/api/storage/objects/uploads/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("/objects/uploads/550e8400-e29b-41d4-a716-446655440000");
  });

  it("adds /objects/ when missing", () => {
    expect(normalizeStorageObjectPath("uploads/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/objects/uploads/550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
