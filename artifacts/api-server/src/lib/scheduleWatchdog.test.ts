import { describe, expect, it } from "vitest";
import {
  startScheduleWatchdog,
  stopScheduleWatchdog,
} from "./scheduleWatchdog";

describe("scheduleWatchdog", () => {
  it("exports start/stop helpers", () => {
    expect(typeof startScheduleWatchdog).toBe("function");
    expect(typeof stopScheduleWatchdog).toBe("function");
  });
});
