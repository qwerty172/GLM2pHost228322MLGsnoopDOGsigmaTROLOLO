import { test } from "node:test";
import assert from "node:assert/strict";
import { session } from "../dist/renderer/renderer/state.js";

test("session defaults", () => {
  assert.equal(session.isStreaming, false);
  assert.equal(session.captureWidth, 1920);
  assert.equal(session.currentSteamTab, "catalog");
  assert.equal(session.libraryEntries.length, 0);
});
