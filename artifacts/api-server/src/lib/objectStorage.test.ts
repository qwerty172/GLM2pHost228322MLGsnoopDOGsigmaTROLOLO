import { describe, expect, it } from "vitest";
import {
  ObjectNotFoundError,
  ObjectStorageNotConfiguredError,
  isObjectStorageConfigured,
} from "./objectStorage";

describe("objectStorage", () => {
  it("isObjectStorageConfigured reflects env", () => {
    expect(typeof isObjectStorageConfigured()).toBe("boolean");
  });

  it("error classes have names", () => {
    expect(new ObjectNotFoundError().name).toBe("ObjectNotFoundError");
    expect(new ObjectStorageNotConfiguredError().name).toBe(
      "ObjectStorageNotConfiguredError",
    );
  });
});
