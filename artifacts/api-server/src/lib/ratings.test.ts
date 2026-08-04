import { describe, expect, it } from "vitest";
import { submitSessionRating } from "./ratings";

describe("ratings", () => {
  it("submitSessionRating is exported", () => {
    expect(typeof submitSessionRating).toBe("function");
  });
});
