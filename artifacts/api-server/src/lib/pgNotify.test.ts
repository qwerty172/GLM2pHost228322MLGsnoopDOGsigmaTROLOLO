import { describe, expect, it } from "vitest";
import { NOTIFY_CHANNEL, subscribePlatformEvents } from "./pgNotify";

describe("pgNotify", () => {
  it("exports channel name and subscribe helper", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
    const unsub = subscribePlatformEvents(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
