import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { NOTIFY_CHANNEL, subscribePlatformEvents } = await import("./pgNotify");

describe("pgNotify", () => {
  it("exposes channel and in-memory subscription", () => {
    expect(NOTIFY_CHANNEL).toBe("decentralhub_events");
    const events: unknown[] = [];
    const unsub = subscribePlatformEvents((e) => events.push(e));
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
