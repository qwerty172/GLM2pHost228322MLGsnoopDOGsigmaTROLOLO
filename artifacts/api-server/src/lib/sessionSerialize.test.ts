import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";
import { sessionsTable } from "@workspace/db";

describe("baseSerialize", () => {
  it("coerces ratePerMinute to number", () => {
    const row = {
      id: "s1",
      ratePerMinute: "1.50",
    } as unknown as typeof sessionsTable.$inferSelect;
    const out = baseSerialize(row);
    expect(out.ratePerMinute).toBe(1.5);
  });
});
