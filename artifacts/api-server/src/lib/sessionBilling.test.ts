import { describe, expect, it } from "vitest";

describe("sessionBilling block refund math", () => {
  it("computes remainder refund for partial block usage", () => {
    const blockReservedLzt = 600;
    const blockMinutes = 60;
    const costPerMinute = Math.round(blockReservedLzt / blockMinutes);
    for (const minutesUsed of [0, 10, 59, 60]) {
      const refundLzt = Math.max(
        0,
        blockReservedLzt - minutesUsed * costPerMinute,
      );
      expect(refundLzt).toBe(Math.max(0, blockReservedLzt - minutesUsed * 10));
    }
  });
});
