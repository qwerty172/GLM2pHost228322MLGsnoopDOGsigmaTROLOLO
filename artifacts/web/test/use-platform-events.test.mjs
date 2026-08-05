import { test } from "node:test";
import assert from "node:assert/strict";

const {
  buildPlatformEventsStreamUrl,
  parsePlatformEventMessage,
  usePlatformEvents,
} = await import("../src/hooks/use-platform-events.ts");

test("buildPlatformEventsStreamUrl appends api/events/stream to base", () => {
  assert.equal(buildPlatformEventsStreamUrl("/app/"), "/app/api/events/stream");
  assert.equal(buildPlatformEventsStreamUrl("/"), "/api/events/stream");
});

test("parsePlatformEventMessage returns null for connected handshake", () => {
  const raw = JSON.stringify({ type: "connected", payload: {}, at: "2026-01-01T00:00:00Z" });
  assert.equal(parsePlatformEventMessage(raw), null);
});

test("parsePlatformEventMessage parses real platform events", () => {
  const raw = JSON.stringify({
    type: "session.started",
    payload: { sessionId: "s-1" },
    at: "2026-01-01T00:00:00Z",
  });
  assert.deepEqual(parsePlatformEventMessage(raw), {
    type: "session.started",
    payload: { sessionId: "s-1" },
    at: "2026-01-01T00:00:00Z",
  });
});

test("parsePlatformEventMessage returns null for malformed JSON", () => {
  assert.equal(parsePlatformEventMessage("{not-json"), null);
  assert.equal(parsePlatformEventMessage(""), null);
});

test("usePlatformEvents is exported React hook", () => {
  assert.equal(typeof usePlatformEvents, "function");
  assert.equal(usePlatformEvents.name, "usePlatformEvents");
});

test("usePlatformEvents forwards parsed events from EventSource", () => {
  let messageHandler = null;
  let closed = false;
  class MockEventSource {
    constructor(url) {
      this.url = url;
    }
    set onmessage(fn) {
      messageHandler = fn;
    }
    close() {
      closed = true;
    }
  }

  const orig = globalThis.EventSource;
  globalThis.EventSource = MockEventSource;

  try {
    const events = [];
    const url = buildPlatformEventsStreamUrl("/");
    const es = new EventSource(url);
    es.onmessage = (msg) => {
      const event = parsePlatformEventMessage(msg.data);
      if (event) events.push(event);
    };

    assert.equal(es.url, "/api/events/stream");

    messageHandler({
      data: JSON.stringify({ type: "connected", payload: {}, at: "2026-01-01T00:00:00Z" }),
    });
    assert.equal(events.length, 0);

    messageHandler({
      data: JSON.stringify({
        type: "session.started",
        payload: { sessionId: "s-1" },
        at: "2026-01-01T00:00:00Z",
      }),
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "session.started");

    es.close();
    assert.equal(closed, true);
  } finally {
    globalThis.EventSource = orig;
  }
});
