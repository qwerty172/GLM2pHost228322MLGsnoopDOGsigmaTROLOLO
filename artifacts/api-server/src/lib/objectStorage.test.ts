import { describe, expect, it, afterEach } from "vitest";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  isObjectStorageConfigured,
  objectStorageClient,
} from "./objectStorage";

describe("objectStorage", () => {
  const prevPublic = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const prevPrivate = process.env.PRIVATE_OBJECT_DIR;

  afterEach(() => {
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = prevPublic;
    process.env.PRIVATE_OBJECT_DIR = prevPrivate;
  });

  it("detects configuration from env", () => {
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    delete process.env.PRIVATE_OBJECT_DIR;
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/bucket/public";
    process.env.PRIVATE_OBJECT_DIR = "/bucket/private";
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it("exposes typed storage errors", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().message).toContain("not configured");
  });

  it("exposes shared GCS client with bucket accessor", () => {
    expect(objectStorageClient).toBeDefined();
    expect(typeof objectStorageClient.bucket).toBe("function");
  });
});
