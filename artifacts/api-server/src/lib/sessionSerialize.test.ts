import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";

describe("baseSerialize", () => {
  it("coerces ratePerMinute to number", () => {
    const row = { id: "s1", ratePerMinute: "12" } as never;
    expect(baseSerialize(row).ratePerMinute).toBe(12);
  });
});
