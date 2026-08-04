import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafeEqualString (timingSafe)", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
  });

  it("rejects unequal strings", () => {
    expect(timingSafeEqualString("secret", "secreX")).toBe(false);
    expect(timingSafeEqualString("a", "ab")).toBe(false);
  });

  it("compares empty strings without throwing", () => {
    expect(timingSafeEqualString("", "")).toBe(true);
    expect(timingSafeEqualString("x", "")).toBe(false);
  });
});
