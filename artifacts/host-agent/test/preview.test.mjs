import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { teardownPreview } = await import(new URL("preview.js", RENDERER_DIST).href);
const { session } = await import(new URL("state.js", RENDERER_DIST).href);

test("teardownPreview closes peer connection and hides indicator", () => {
  const indicator = document.getElementById("preview-indicator");
  indicator.hidden = false;
  session.previewPc = { close: () => {} };
  session.previewOwnStream = {
    getTracks: () => [{ stop: () => {} }],
  };
  teardownPreview();
  assert.equal(session.previewPc, null);
  assert.equal(session.previewOwnStream, null);
  assert.equal(indicator.hidden, true);
});
