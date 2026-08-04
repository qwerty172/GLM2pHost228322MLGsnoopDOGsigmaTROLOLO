import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafeEqualString (timingSafe module)", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualString("same", "same")).toBe(true);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqualString("a", "ab")).toBe(false);
  });
});
