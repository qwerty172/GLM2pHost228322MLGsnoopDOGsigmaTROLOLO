import { describe, expect, it } from "vitest";
import { toObjectEntityPath } from "./storageRouteHelpers";
import { isCoverUploadObjectPath } from "./storageObjectPath";

describe("toObjectEntityPath", () => {
  it("normalizes API and object paths", () => {
    expect(toObjectEntityPath("/objects/uploads/abc")).toBe("/objects/uploads/abc");
    expect(toObjectEntityPath("/api/storage/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
    expect(toObjectEntityPath("https://example.com/cover.jpg")).toBeNull();
    expect(toObjectEntityPath("")).toBeNull();
  });
});

describe("isCoverUploadObjectPath", () => {
  it("accepts presigned cover upload paths", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(isCoverUploadObjectPath(`/objects/uploads/${uuid}`)).toBe(true);
    expect(
      isCoverUploadObjectPath(`/api/storage/objects/uploads/${uuid}`),
    ).toBe(true);
  });

  it("rejects save archives and other namespaces", () => {
    expect(
      isCoverUploadObjectPath("/objects/saves/player-1/game-1/save.zip"),
    ).toBe(false);
    expect(isCoverUploadObjectPath("/objects/uploads/not-a-uuid")).toBe(false);
    expect(isCoverUploadObjectPath("/rf3-cover.svg")).toBe(false);
  });
});
