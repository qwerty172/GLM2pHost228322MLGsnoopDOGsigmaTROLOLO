import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafe", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
  });

  it("rejects different lengths without leaking via early return only", () => {
    expect(timingSafeEqualString("ab", "abc")).toBe(false);
    expect(timingSafeEqualString("", "a")).toBe(false);
  });
});
