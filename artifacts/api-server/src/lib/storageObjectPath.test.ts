import { describe, expect, it } from "vitest";
import { normalizeStorageObjectPath } from "./storageObjectPath";

describe("normalizeStorageObjectPath", () => {
  it("normalizes API-facing paths", () => {
    expect(
      normalizeStorageObjectPath("/api/storage/objects/uploads/abc-123"),
    ).toBe("/objects/uploads/abc-123");
  });

  it("normalizes bare object paths", () => {
    expect(normalizeStorageObjectPath("/objects/uploads/abc-123")).toBe(
      "/objects/uploads/abc-123",
    );
    expect(normalizeStorageObjectPath("objects/uploads/abc-123")).toBe(
      "/objects/uploads/abc-123",
    );
  });

  it("strips host from full URLs", () => {
    expect(
      normalizeStorageObjectPath(
        "https://example.com/api/storage/objects/uploads/abc-123",
      ),
    ).toBe("/objects/uploads/abc-123");
  });

  it("returns empty for blank input", () => {
    expect(normalizeStorageObjectPath("")).toBe("");
    expect(normalizeStorageObjectPath("   ")).toBe("");
  });
});
