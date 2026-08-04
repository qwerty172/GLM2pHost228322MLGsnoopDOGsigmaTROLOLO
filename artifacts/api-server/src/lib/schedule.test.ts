import { describe, expect, it } from "vitest";
import {
  isHostAvailableNow,
  isWithinSchedule,
  minutesSinceWindowStart,
} from "./schedule";

describe("schedule", () => {
  const mondaySlot = [{ day: 1, startMin: 9 * 60, endMin: 17 * 60 }];
  const monday1030 = new Date("2026-01-05T10:30:00.000Z");

  it("detects slot membership in UTC", () => {
    expect(isWithinSchedule(mondaySlot, monday1030)).toBe(true);
    expect(minutesSinceWindowStart(mondaySlot, monday1030)).toBe(90);
    expect(isWithinSchedule(mondaySlot, new Date("2026-01-05T20:00:00.000Z"))).toBe(
      false,
    );
  });

  it("respects schedule mode", () => {
    expect(isHostAvailableNow("always", null)).toBe(true);
    expect(isHostAvailableNow("scheduled", mondaySlot, monday1030)).toBe(true);
    expect(isHostAvailableNow("off", mondaySlot, monday1030)).toBe(false);
  });
});
