import { describe, expect, it } from "vitest";
import { ObjectNotFoundError, ObjectStorageNotConfiguredError } from "./objectStorage";

describe("objectStorage errors", () => {
  it("ObjectNotFoundError has correct name", () => {
    const err = new ObjectNotFoundError();
    expect(err.message).toBe("Object not found");
    expect(err.name).toBe("ObjectNotFoundError");
  });

  it("ObjectStorageNotConfiguredError is defined", () => {
    const err = new ObjectStorageNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
  });
});
