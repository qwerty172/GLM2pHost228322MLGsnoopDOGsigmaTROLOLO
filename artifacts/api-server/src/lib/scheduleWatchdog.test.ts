import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

describe("scheduleWatchdog", () => {
  it("exports watchdog lifecycle", async () => {
    const mod = await import("./scheduleWatchdog");
    expect(typeof mod.startScheduleWatchdog).toBe("function");
    expect(typeof mod.stopScheduleWatchdog).toBe("function");
  });
});
