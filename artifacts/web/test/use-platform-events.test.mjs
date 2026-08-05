import { test } from "node:test";
import assert from "node:assert/strict";

const {
  buildPlatformEventsStreamUrl,
  parsePlatformEventMessage,
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
