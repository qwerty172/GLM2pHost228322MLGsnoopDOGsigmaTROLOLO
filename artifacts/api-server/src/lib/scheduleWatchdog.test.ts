import { describe, expect, it, afterEach } from "vitest";
import { startScheduleWatchdog, stopScheduleWatchdog } from "./scheduleWatchdog";

describe("scheduleWatchdog", () => {
  afterEach(() => {
    stopScheduleWatchdog();
  });

  it("exports start/stop", () => {
    expect(typeof startScheduleWatchdog).toBe("function");
    expect(typeof stopScheduleWatchdog).toBe("function");
  });

  it("start/stop without throwing", () => {
    expect(() => startScheduleWatchdog()).not.toThrow();
    expect(() => stopScheduleWatchdog()).not.toThrow();
  });
});
