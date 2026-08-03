import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("session starts with idle streaming flags", () => {
  assert.equal(session.isStreaming, false);
  assert.equal(session.currentSessionId, null);
  assert.equal(session.captureWidth, 1920);
  assert.equal(session.captureHeight, 1080);
  assert.deepEqual(session.libraryEntries, []);
});
