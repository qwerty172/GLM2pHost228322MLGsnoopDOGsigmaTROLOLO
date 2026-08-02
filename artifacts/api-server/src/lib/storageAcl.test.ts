import { describe, expect, it } from "vitest";
import {
  isLegacyPublicCoverObjectPath,
  normalizeStorageObjectPath,
} from "./storageAcl";

describe("normalizeStorageObjectPath", () => {
  it("accepts /objects paths", () => {
    expect(normalizeStorageObjectPath("/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
  });

  it("strips /api/storage prefix", () => {
    expect(
      normalizeStorageObjectPath("/api/storage/objects/uploads/abc"),
    ).toBe("/objects/uploads/abc");
  });

  it("rejects non-storage paths", () => {
    expect(normalizeStorageObjectPath("https://example.com/x")).toBeNull();
    expect(normalizeStorageObjectPath("/public/foo")).toBeNull();
    expect(normalizeStorageObjectPath("")).toBeNull();
  });
});

describe("isLegacyPublicCoverObjectPath", () => {
  it("allows single-segment uploads", () => {
    expect(
      isLegacyPublicCoverObjectPath(
        "/objects/uploads/550e8400-e29b-41d4-a716-446655440000",
      ),
    ).toBe(true);
  });

  it("rejects nested paths and other namespaces", () => {
    expect(isLegacyPublicCoverObjectPath("/objects/uploads/a/b")).toBe(false);
    expect(
      isLegacyPublicCoverObjectPath("/objects/saves/player/game/save.zip"),
    ).toBe(false);
    expect(isLegacyPublicCoverObjectPath("/objects/clips/clip.webm")).toBe(
      false,
    );
  });
});
