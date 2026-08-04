import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("normalizeStorageObjectPath", () => {
  it("normalizes full URLs and relative paths", () => {
    expect(normalizeStorageObjectPath("https://cdn.example.com/objects/foo/bar.png")).toBe(
      "/objects/foo/bar.png",
    );
    expect(normalizeStorageObjectPath("/objects/foo/bar.png?token=abc")).toBe(
      "/objects/foo/bar.png",
    );
  });

  it("rejects invalid paths", () => {
    expect(normalizeStorageObjectPath("")).toBeNull();
    expect(normalizeStorageObjectPath("/uploads/foo")).toBeNull();
    expect(normalizeStorageObjectPath("/objects/../secret")).toBeNull();
  });
});
