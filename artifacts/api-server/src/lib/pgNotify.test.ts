import { describe, expect, it } from "vitest";
import { NOTIFY_CHANNEL, subscribePlatformEvents } from "./pgNotify";

describe("pgNotify", () => {
  it("exports channel name", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
  });

  it("subscribePlatformEvents returns unsubscribe", () => {
    const fn = () => {};
    const unsub = subscribePlatformEvents(fn);
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
