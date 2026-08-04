import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("storageObjectPath", () => {
  it("normalizes absolute and relative object paths", () => {
    expect(normalizeStorageObjectPath("https://cdn.example/objects/foo/bar.png")).toBe("/objects/foo/bar.png");
    expect(normalizeStorageObjectPath("/objects/cover.jpg")).toBe("/objects/cover.jpg");
    expect(normalizeStorageObjectPath("  ")).toBeNull();
    expect(normalizeStorageObjectPath("/objects/../secret")).toBeNull();
  });
});
