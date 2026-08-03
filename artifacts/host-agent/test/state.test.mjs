import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { session } = await import("../dist/renderer/renderer/state.js");

test("session exposes default runtime fields", () => {
  assert.equal(session.isStreaming, false);
  assert.equal(session.currentSessionId, null);
  assert.deepEqual(session.libraryEntries, []);
  assert.equal(session.currentSteamTab, "catalog");
  assert.equal(session.steamIsFirstScan, true);
});
