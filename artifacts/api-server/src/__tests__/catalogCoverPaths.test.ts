import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeStorageObjectPath } from "../lib/storageObjectPath.js";

describe("normalizeStorageObjectPath", () => {
  it("normalizes API-facing paths", () => {
    assert.equal(
      normalizeStorageObjectPath("/api/storage/objects/uploads/abc-123"),
      "/objects/uploads/abc-123",
    );
  });

  it("normalizes bare object paths", () => {
    assert.equal(
      normalizeStorageObjectPath("/objects/uploads/abc-123"),
      "/objects/uploads/abc-123",
    );
  });

  it("normalizes absolute URLs", () => {
    assert.equal(
      normalizeStorageObjectPath(
        "https://example.com/api/storage/objects/uploads/abc-123?token=1",
      ),
      "/objects/uploads/abc-123",
    );
  });

  it("rejects traversal and non-storage paths", () => {
    assert.equal(normalizeStorageObjectPath("/rf3-cover.svg"), null);
    assert.equal(
      normalizeStorageObjectPath("/api/storage/objects/uploads/../secret"),
      null,
    );
    assert.equal(normalizeStorageObjectPath(""), null);
  });
});
