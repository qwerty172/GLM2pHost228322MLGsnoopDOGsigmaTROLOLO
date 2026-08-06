import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { teardownPreview, connectPreviewWs } = await import("../dist/renderer/renderer/preview.js");
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

test("connectPreviewWs skips when preview disabled", () => {
  session.previewWs = null;
  connectPreviewWs({ ...defaultHostConfig, allowPreview: false });
  assert.equal(session.previewWs, null);
});

test("connectPreviewWs does nothing without host token", () => {
  session.previewWs = null;
  connectPreviewWs({ ...defaultHostConfig, hostToken: "" });
  assert.equal(session.previewWs, null);
});

test("connectPreviewWs opens preview signaling WebSocket", () => {
  let capturedUrl = "";
  const OrigWs = globalThis.WebSocket;
  class MockWs {
    static OPEN = 1;
    readyState = 1;
    constructor(url) {
      capturedUrl = url;
    }
    send() {}
    close() {}
  }
  globalThis.WebSocket = MockWs;
  globalThis.window.WebSocket = MockWs;

  session.previewWs = null;
  connectPreviewWs({
    ...defaultHostConfig,
    hostToken: "preview-tok",
    apiBaseUrl: "https://platform.example.com",
  });

  assert.match(capturedUrl, /type=preview/);
  assert.match(capturedUrl, /hostToken=preview-tok/);
  assert.ok(session.previewWs instanceof MockWs);

  globalThis.WebSocket = OrigWs;
  globalThis.window.WebSocket = OrigWs;
  session.previewWs = null;
});
