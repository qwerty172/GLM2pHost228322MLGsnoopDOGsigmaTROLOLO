import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCoverUploadObjectPath,
  normalizeStorageObjectPath,
} from "../lib/storageObjectPath.js";

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";

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

describe("isCoverUploadObjectPath", () => {
  it("allows cover upload UUID paths", () => {
    assert.equal(
      isCoverUploadObjectPath(`/api/storage/objects/uploads/${SAMPLE_UUID}`),
      true,
    );
    assert.equal(
      isCoverUploadObjectPath(`/objects/uploads/${SAMPLE_UUID}`),
      true,
    );
  });

  it("rejects save and nested paths", () => {
    assert.equal(
      isCoverUploadObjectPath(
        `/objects/saves/player/game/${SAMPLE_UUID}.zip`,
      ),
      false,
    );
    assert.equal(
      isCoverUploadObjectPath(`/objects/uploads/${SAMPLE_UUID}/thumb`),
      false,
    );
    assert.equal(isCoverUploadObjectPath("/objects/uploads/not-a-uuid"), false);
  });
});
