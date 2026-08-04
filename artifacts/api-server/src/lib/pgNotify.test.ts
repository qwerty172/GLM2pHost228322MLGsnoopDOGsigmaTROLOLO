import { describe, expect, it } from "vitest";
import {
  NOTIFY_CHANNEL,
  subscribePlatformEvents,
  emitPlatformEvent,
} from "./pgNotify";

describe("pgNotify", () => {
  it("exports channel name", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
  });

  it("subscribePlatformEvents returns unsubscribe fn", () => {
    const events: string[] = [];
    const unsub = subscribePlatformEvents((e) => events.push(e.type));
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("emitPlatformEvent fans out to local listeners even if pg_notify fails", async () => {
    const received: string[] = [];
    const unsub = subscribePlatformEvents((e) => received.push(e.type));
    await emitPlatformEvent("test.event", { foo: "bar" });
    expect(received).toContain("test.event");
    unsub();
  });
});
