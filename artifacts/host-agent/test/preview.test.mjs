import { test, before } from "node:test";
import assert from "node:assert/strict";
import { installRendererDom } from "./helpers/dom-setup.mjs";

let teardownPreview;
let session;

before(async () => {
  installRendererDom();
  ({ teardownPreview } = await import("../dist/renderer/renderer/preview.js"));
  ({ session } = await import("../dist/renderer/renderer/state.js"));
});

test("teardownPreview clears preview state", () => {
  session.previewPc = new RTCPeerConnection();
  teardownPreview();
  assert.equal(session.previewPc, null);
});
