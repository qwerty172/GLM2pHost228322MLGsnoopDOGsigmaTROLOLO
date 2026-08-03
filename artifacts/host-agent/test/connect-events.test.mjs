import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
await import("../dist/renderer/renderer/connect-events.js");
const { session } = await import("../dist/renderer/renderer/state.js");
const { connectBtn } = await import("../dist/renderer/renderer/dom.js");

test("connect-events wires connect button and blocks when session active", async () => {
  assert.equal(typeof connectBtn.onclick, "object"); // listener attached via addEventListener
  session.currentSessionId = "sess-1";
  const { logEl } = await import("../dist/renderer/renderer/dom.js");
  const before = logEl.textContent;
  connectBtn.click();
  assert.match(logEl.textContent, /Already online/);
  assert.notEqual(logEl.textContent, before);
  session.currentSessionId = null;
});
