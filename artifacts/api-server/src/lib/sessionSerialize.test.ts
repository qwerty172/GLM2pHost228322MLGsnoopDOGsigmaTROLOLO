import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";

describe("sessionSerialize", () => {
  it("baseSerialize coerces ratePerMinute to number", () => {
    const row = {
      id: "s1",
      ratePerMinute: "12.5",
    } as Parameters<typeof baseSerialize>[0];
    expect(baseSerialize(row).ratePerMinute).toBe(12.5);
  });
});
