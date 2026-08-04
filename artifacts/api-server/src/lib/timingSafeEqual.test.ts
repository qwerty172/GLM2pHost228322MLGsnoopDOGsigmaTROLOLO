import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafeEqual";

describe("timingSafeEqualString", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
  });

  it("rejects unequal or empty", () => {
    expect(timingSafeEqualString("a", "b")).toBe(false);
    expect(timingSafeEqualString("", "x")).toBe(false);
  });
});
