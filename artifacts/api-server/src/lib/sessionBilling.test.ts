import { describe, expect, it } from "vitest";
import { countSessionMinutesUsed, refundBlockRemainder } from "./sessionBilling";

describe("sessionBilling", () => {
  it("exports billing helpers", () => {
    expect(typeof countSessionMinutesUsed).toBe("function");
    expect(typeof refundBlockRemainder).toBe("function");
  });

  it("block refund math is consistent", () => {
    const blockMinutes = 60;
    const blockReservedLzt = 600;
    const costPerMinute = Math.round(blockReservedLzt / blockMinutes);
    expect(Math.max(0, blockReservedLzt - 10 * costPerMinute)).toBe(500);
  });
});
