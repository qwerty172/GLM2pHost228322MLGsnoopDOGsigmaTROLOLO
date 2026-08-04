import { describe, expect, it } from "vitest";
import { startScheduleWatchdog, stopScheduleWatchdog } from "./scheduleWatchdog";

describe("scheduleWatchdog", () => {
  it("start/stop without throwing", () => {
    startScheduleWatchdog();
    stopScheduleWatchdog();
    expect(true).toBe(true);
  });
});
