import { test } from "node:test";
import assert from "node:assert/strict";

const { session } = await import("../dist/renderer/renderer/state.js");

test("session has default runtime fields", () => {
  assert.equal(session.pc, null);
  assert.equal(session.currentSessionId, null);
  assert.equal(session.isStreaming, false);
  assert.deepEqual(session.libraryEntries, []);
  assert.equal(session.captureWidth, 1920);
  assert.equal(session.captureHeight, 1080);
});

test("session steam tab defaults to catalog", () => {
  assert.equal(session.currentSteamTab, "catalog");
  assert.equal(session.steamScanInFlight, false);
});
