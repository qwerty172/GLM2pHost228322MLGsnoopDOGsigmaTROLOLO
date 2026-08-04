import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafeEqual";

describe("timingSafeEqual", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("secret-a", "secret-a")).toBe(true);
  });

  it("rejects unequal or empty values", () => {
    expect(timingSafeEqualString("a", "b")).toBe(false);
    expect(timingSafeEqualString("", "x")).toBe(false);
    expect(timingSafeEqualString("short", "longer")).toBe(false);
  });
});
