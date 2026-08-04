import { describe, expect, it } from "vitest";
import { baseSerialize } from "./sessionSerialize";
import type { sessionsTable } from "@workspace/db";

describe("sessionSerialize", () => {
  it("baseSerialize coerces ratePerMinute to number", () => {
    const session = {
      id: "s1",
      ratePerMinute: "12.5",
    } as unknown as typeof sessionsTable.$inferSelect;
    expect(baseSerialize(session).ratePerMinute).toBe(12.5);
  });
});
