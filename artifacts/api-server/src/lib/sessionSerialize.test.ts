import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";

describe("sessionSerialize", () => {
  it("baseSerialize coerces ratePerMinute to number", () => {
    const row = {
      id: "s1",
      ratePerMinute: "12.5",
      status: "active",
    } as never;
    expect(baseSerialize(row).ratePerMinute).toBe(12.5);
  });
});
