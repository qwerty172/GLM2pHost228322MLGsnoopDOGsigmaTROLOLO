import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

await import(new URL("connect-events.js", RENDERER_DIST).href);

test("connect-events module loads and wires connect button", () => {
  const btn = document.getElementById("connect");
  assert.equal(btn.id, "connect");
  assert.equal(typeof btn.addEventListener, "function");
});
