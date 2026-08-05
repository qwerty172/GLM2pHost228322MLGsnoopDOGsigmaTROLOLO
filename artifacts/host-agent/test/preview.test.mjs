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

test("preview peer-joined does not fall back to full desktop when game window missing", async () => {
  teardownPreview();
  session.captureStream = null;
  session.previewPc = null;
  session.previewOwnStream = null;
  session.currentConfig = { ...defaultHostConfig };
  session.libraryEntries = [
    { gameId: "game-1", appPath: "C:\\Games\\rf3\\RogueFable3.exe", enabled: true, localAvailable: true },
  ];

  const sent = [];
  let wsHandler = null;
  const OriginalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class MockPreviewWs {
    static OPEN = 1;
    readyState = 1;
    constructor() {
      session.previewWs = this;
    }
    set onmessage(fn) {
      wsHandler = fn;
    }
    get onmessage() {
      return wsHandler;
    }
    send(payload) {
      sent.push(JSON.parse(payload));
    }
    close() {}
  };

  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:2", name: "Discord" },
  ];
  window.agent.getSpawnHwnds = async () => ({ pid: null, hwnds: [] });

  try {
    const cfg = { ...defaultHostConfig, allowPreview: true, signalingUrl: "wss://platform.example.com/api/signal" };
    connectPreviewWs(cfg);
    assert.equal(typeof wsHandler, "function");

    await wsHandler({
      data: JSON.stringify({ type: "peer-joined", role: "player" }),
    });

    assert.equal(session.previewPc, null);
    assert.equal(session.previewOwnStream, null);
    assert.deepEqual(sent, [{ type: "preview-error", reason: "no_game_window" }]);
    assert.equal(document.getElementById("preview-indicator").hidden, true);
  } finally {
    globalThis.WebSocket = OriginalWebSocket;
  }
});
