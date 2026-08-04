import { describe, expect, it } from "vitest";
import { verifierDb } from "./verifierDb";

describe("verifierDb", () => {
  it("exports verifier db adapter", () => {
    expect(typeof verifierDb).toBe("object");
  });
});
