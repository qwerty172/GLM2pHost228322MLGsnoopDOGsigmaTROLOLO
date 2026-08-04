import { describe, expect, it } from "vitest";

describe("scheduleWatchdog", () => {
  it("module imports", async () => {
    const mod = await import("./scheduleWatchdog");
    expect(typeof mod.startScheduleWatchdog).toBe("function");
  });
});
