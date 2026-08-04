import { describe, expect, it } from "vitest";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  isObjectStorageConfigured,
} from "./objectStorage";

describe("objectStorage", () => {
  it("isObjectStorageConfigured requires both env vars", () => {
    const pub = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    const priv = process.env.PRIVATE_OBJECT_DIR;
    delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    delete process.env.PRIVATE_OBJECT_DIR;
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/public";
    expect(isObjectStorageConfigured()).toBe(false);
    process.env.PRIVATE_OBJECT_DIR = "/private";
    expect(isObjectStorageConfigured()).toBe(true);
    if (pub) process.env.PUBLIC_OBJECT_SEARCH_PATHS = pub;
    else delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
    if (priv) process.env.PRIVATE_OBJECT_DIR = priv;
    else delete process.env.PRIVATE_OBJECT_DIR;
  });

  it("error classes have correct names", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().name).toBe("ObjectStorageNotConfiguredError");
  });
});
