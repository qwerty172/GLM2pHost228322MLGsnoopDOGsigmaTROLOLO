import { describe, expect, it } from "vitest";
import { coverUrlToObjectPath } from "./storageAclPaths";

describe("coverUrlToObjectPath", () => {
  it("maps API-facing cover URLs to /objects paths", () => {
    expect(
      coverUrlToObjectPath("/api/storage/objects/uploads/abc-123"),
    ).toBe("/objects/uploads/abc-123");
  });

  it("accepts raw /objects paths", () => {
    expect(coverUrlToObjectPath("/objects/uploads/abc-123")).toBe(
      "/objects/uploads/abc-123",
    );
  });

  it("rejects external http(s) URLs", () => {
    expect(
      coverUrlToObjectPath("https://cdn.example.com/cover.jpg"),
    ).toBeNull();
    expect(coverUrlToObjectPath("")).toBeNull();
  });
});
