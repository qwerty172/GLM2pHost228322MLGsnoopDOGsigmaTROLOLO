import { describe, expect, it, afterEach } from "vitest";
import { isObjectStorageConfigured, ObjectNotFoundError, ObjectStorageNotConfiguredError } from "./objectStorage";

describe("objectStorage", () => {
  const pub = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  const priv = process.env.PRIVATE_OBJECT_DIR;

  afterEach(() => {
    if (pub === undefined) delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    else process.env.PUBLIC_OBJECT_SEARCH_PATHS = pub;
    if (priv === undefined) delete process.env.PRIVATE_OBJECT_DIR;
    else process.env.PRIVATE_OBJECT_DIR = priv;
  });

  it("isObjectStorageConfigured requires both env vars", () => {
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    delete process.env.PRIVATE_OBJECT_DIR;
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/public";
    process.env.PRIVATE_OBJECT_DIR = "/private";
    expect(isObjectStorageConfigured()).toBe(true);
  });

  it("error classes have names", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().name).toBe("ObjectStorageNotConfiguredError");
  });
});
