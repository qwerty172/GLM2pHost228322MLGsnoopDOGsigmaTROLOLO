import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafeEqual";

describe("timingSafeEqualString", () => {
  it("matches equal secrets", () => {
    expect(timingSafeEqualString("admin-secret", "admin-secret")).toBe(true);
  });

  it("rejects unequal or empty values", () => {
    expect(timingSafeEqualString("admin-secret", "admin-secreX")).toBe(false);
    expect(timingSafeEqualString("", "x")).toBe(false);
  });
});
