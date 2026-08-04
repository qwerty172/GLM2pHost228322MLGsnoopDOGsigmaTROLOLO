import { describe, expect, it } from "vitest";
import {
  isHostAvailableNow,
  isWithinSchedule,
  minutesSinceWindowStart,
} from "./schedule";

describe("session eligibility (schedule)", () => {
  const mondayMorning = new Date("2026-07-20T10:30:00Z");
  const slots = [{ day: 1, startMin: 9 * 60, endMin: 12 * 60 }];

  it("isWithinSchedule matches UTC slots", () => {
    expect(isWithinSchedule(slots, mondayMorning)).toBe(true);
    expect(isWithinSchedule(slots, new Date("2026-07-20T08:00:00Z"))).toBe(false);
    expect(isWithinSchedule([], mondayMorning)).toBe(false);
  });

  it("minutesSinceWindowStart tracks elapsed minutes", () => {
    expect(minutesSinceWindowStart(slots, mondayMorning)).toBe(90);
    expect(minutesSinceWindowStart(slots, new Date("2026-07-20T08:00:00Z"))).toBeNull();
  });

  it("isHostAvailableNow respects scheduleMode", () => {
    expect(isHostAvailableNow("always", [], mondayMorning)).toBe(true);
    expect(isHostAvailableNow("scheduled", slots, mondayMorning)).toBe(true);
    expect(isHostAvailableNow("scheduled", slots, new Date("2026-07-21T10:00:00Z"))).toBe(false);
    expect(isHostAvailableNow("off", slots, mondayMorning)).toBe(false);
  });
});
