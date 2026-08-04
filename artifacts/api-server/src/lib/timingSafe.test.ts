import { describe, expect, it } from "vitest";
import { timingSafeEqualString } from "./timingSafe";

describe("timingSafeEqualString (timingSafe)", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqualString("secret", "secret")).toBe(true);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqualString("short", "longer-secret")).toBe(false);
  });
});
