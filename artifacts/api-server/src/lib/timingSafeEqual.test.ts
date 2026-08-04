import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafeEqual";

describe("timingSafeEqual", () => {
  it("compares equal strings", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("secret", "public")).toBe(false);
  });

  it("rejects empty values", () => {
    expect(timingSafeEqualString("", "x")).toBe(false);
    expect(timingSafeEqualString("x", "")).toBe(false);
  });
});
