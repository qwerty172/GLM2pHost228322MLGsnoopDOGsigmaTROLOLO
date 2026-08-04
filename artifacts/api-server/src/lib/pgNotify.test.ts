import { describe, expect, it } from "vitest";
import { NOTIFY_CHANNEL, subscribePlatformEvents } from "./pgNotify";

describe("pgNotify", () => {
  it("exports NOTIFY channel name", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
  });

  it("subscribePlatformEvents returns unsubscribe fn", () => {
    const unsub = subscribePlatformEvents(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
