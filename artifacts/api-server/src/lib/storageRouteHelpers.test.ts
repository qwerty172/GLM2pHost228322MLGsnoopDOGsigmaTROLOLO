import { describe, expect, it } from "vitest";
import { toObjectEntityPath } from "./storageRouteHelpers";

describe("toObjectEntityPath", () => {
  it("normalizes API and object paths", () => {
    expect(toObjectEntityPath("/objects/uploads/abc")).toBe("/objects/uploads/abc");
    expect(toObjectEntityPath("/api/storage/objects/uploads/abc")).toBe(
      "/objects/uploads/abc",
    );
    expect(toObjectEntityPath("https://example.com/cover.jpg")).toBeNull();
    expect(toObjectEntityPath("")).toBeNull();
  });
});
