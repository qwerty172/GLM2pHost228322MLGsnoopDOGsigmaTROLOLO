import { describe, expect, it } from "vitest";

describe("ratings validation", () => {
  it("score must be integer 1-5", () => {
    const valid = (score: number) => Number.isInteger(score) && score >= 1 && score <= 5;
    expect(valid(3)).toBe(true);
    expect(valid(0)).toBe(false);
    expect(valid(6)).toBe(false);
  });
});
