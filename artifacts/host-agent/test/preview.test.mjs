import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { teardownPreview } = await import("../dist/renderer/renderer/preview.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("teardownPreview hides preview indicator and clears preview state", () => {
  session.previewPc = new RTCPeerConnection();
  session.previewOwnStream = new MediaStream();
  document.getElementById("preview-indicator").hidden = false;

  teardownPreview();

  assert.equal(session.previewPc, null);
  assert.equal(session.previewOwnStream, null);
  assert.equal(document.getElementById("preview-indicator").hidden, true);
});
