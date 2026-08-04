import { describe, expect, it, afterEach } from "vitest";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  ObjectStorageService,
  isObjectStorageConfigured,
} from "./objectStorage";

describe("objectStorage", () => {
  const prevPublic = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const prevPrivate = process.env.PRIVATE_OBJECT_DIR;

  afterEach(() => {
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = prevPublic;
    process.env.PRIVATE_OBJECT_DIR = prevPrivate;
  });

  it("isObjectStorageConfigured requires both env vars", () => {
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    delete process.env.PRIVATE_OBJECT_DIR;
    expect(isObjectStorageConfigured()).toBe(false);

    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/bucket/public";
    process.env.PRIVATE_OBJECT_DIR = "/bucket/private";
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it("ObjectStorageService throws when paths unset", () => {
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const svc = new ObjectStorageService();
    expect(() => svc.getPublicObjectSearchPaths()).toThrow(ObjectStorageNotConfiguredError);
  });

  it("error classes have correct names", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().name).toBe("ObjectStorageNotConfiguredError");
  });
});
