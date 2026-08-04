import { describe, expect, it } from "vitest";

describe("scheduleWatchdog", () => {
  it("module loads and exports worker controls", async () => {
    const mod = await import("./scheduleWatchdog");
    expect(typeof mod.startScheduleWatchdog).toBe("function");
    expect(typeof mod.stopScheduleWatchdog).toBe("function");
  });
});
