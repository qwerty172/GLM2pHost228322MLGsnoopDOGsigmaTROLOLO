import { describe, expect, it } from "vitest";
import {
  isLegacyPublicUploadPath,
  normalizeStorageObjectPath,
} from "./storageAcl";

describe("normalizeStorageObjectPath", () => {
  it("accepts /objects/ paths", () => {
    expect(normalizeStorageObjectPath("/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
  });

  it("strips /api/storage prefix", () => {
    expect(
      normalizeStorageObjectPath(
        "/api/storage/objects/uploads/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe("/objects/uploads/550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects unknown prefixes", () => {
    expect(normalizeStorageObjectPath("https://cdn.example/cover.jpg")).toBeNull();
    expect(normalizeStorageObjectPath("")).toBeNull();
  });
});

describe("isLegacyPublicUploadPath", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";

  it("allows legacy cover uploads", () => {
    expect(isLegacyPublicUploadPath(`/objects/uploads/${uuid}`)).toBe(true);
    expect(isLegacyPublicUploadPath(`/api/storage/objects/uploads/${uuid}`)).toBe(
      true,
    );
  });

  it("rejects nested or non-upload paths", () => {
    expect(isLegacyPublicUploadPath(`/objects/uploads/${uuid}/thumb`)).toBe(false);
    expect(isLegacyPublicUploadPath(`/objects/saves/player/game/save.zip`)).toBe(
      false,
    );
    expect(isLegacyPublicUploadPath("/objects/uploads/not-a-uuid")).toBe(false);
  });
});
