import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { baseSerialize } = await import("./sessionSerialize");

describe("sessionSerialize", () => {
  it("coerces ratePerMinute to number", () => {
    const row = {
      id: "s1",
      ratePerMinute: "1.50",
    } as Parameters<typeof baseSerialize>[0];
    expect(baseSerialize(row).ratePerMinute).toBe(1.5);
  });
});
