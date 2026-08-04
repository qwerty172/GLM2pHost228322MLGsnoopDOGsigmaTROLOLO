import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("normalizeStorageObjectPath", () => {
  it("normalizes object paths", () => {
    expect(normalizeStorageObjectPath("/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
    expect(normalizeStorageObjectPath("https://x.com/objects/foo/bar")).toBe(
      "/objects/foo/bar",
    );
    expect(normalizeStorageObjectPath("/objects/../evil")).toBeNull();
    expect(normalizeStorageObjectPath("")).toBeNull();
  });
});
