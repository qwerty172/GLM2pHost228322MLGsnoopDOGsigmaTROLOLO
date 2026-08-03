import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { elements } from "../test/setup-renderer-dom.mjs";

const { teardownPreview } = await import("../dist/renderer/renderer/preview.js");
const { session } = await import("../dist/renderer/renderer/state.js");

test("teardownPreview clears preview state", () => {
  session.previewPc = new RTCPeerConnection();
  session.previewOwnStream = new MediaStream();
  const indicator = elements.get("preview-indicator");
  indicator.hidden = false;
  teardownPreview();
  assert.equal(session.previewPc, null);
  assert.equal(session.previewOwnStream, null);
  assert.equal(indicator.hidden, true);
});

test("connectPreviewWs skips when preview disabled", async () => {
  const { connectPreviewWs } = await import("../dist/renderer/renderer/preview.js");
  session.previewWs = null;
  connectPreviewWs({
    hostToken: "tok",
    apiBaseUrl: "https://api.example.com",
    allowPreview: false,
    signalingUrl: "",
    appPath: "",
    ratePerMinute: 1,
    commissionSplit: 0.7,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 6000,
    audioMode: "off",
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
  });
  assert.equal(session.previewWs, null);
});
