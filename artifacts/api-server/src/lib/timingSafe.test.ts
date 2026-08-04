import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafe (alt)", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualString("same", "same")).toBe(true);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqualString("short", "longer")).toBe(false);
  });
});
