import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("normalizeStorageObjectPath", () => {
  it("normalizes absolute and relative object paths", () => {
    expect(normalizeStorageObjectPath("https://cdn.example.com/objects/saves/abc")).toBe(
      "/objects/saves/abc",
    );
    expect(normalizeStorageObjectPath("/objects/uploads/x.png")).toBe(
      "/objects/uploads/x.png",
    );
  });

  it("rejects empty and traversal paths", () => {
    expect(normalizeStorageObjectPath("")).toBeNull();
    expect(normalizeStorageObjectPath("/objects/../secret")).toBeNull();
  });
});
