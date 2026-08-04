import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafe", () => {
  it("compares equal strings", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
    expect(timingSafeEqualString("secret", "public")).toBe(false);
  });

  it("rejects unequal lengths", () => {
    expect(timingSafeEqualString("a", "ab")).toBe(false);
  });
});
