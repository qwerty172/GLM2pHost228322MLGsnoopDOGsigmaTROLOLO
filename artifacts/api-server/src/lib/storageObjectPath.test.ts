import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("normalizeStorageObjectPath", () => {
  it("normalizes absolute and relative paths", () => {
    expect(normalizeStorageObjectPath("https://cdn.example/objects/covers/a.png")).toBe("/objects/covers/a.png");
    expect(normalizeStorageObjectPath("/objects/foo")).toBe("/objects/foo");
    expect(normalizeStorageObjectPath("/objects/../evil")).toBeNull();
    expect(normalizeStorageObjectPath("")).toBeNull();
  });
});
