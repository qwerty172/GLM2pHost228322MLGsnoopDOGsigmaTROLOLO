import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const {
  createSession,
  showPlayerLink,
  connect,
  attachWsHandlers,
  sendControlReject,
  fetchSessionContext,
  onPlayerJoined,
  uploadHostStats,
  teardownPeer,
  cancelDeferredTeardown,
  teardownDeferred,
  teardown,
  teardownAsync,
} = await import("../dist/renderer/renderer/session.js");
const { session } = await import("../dist/renderer/renderer/state.js");
const { connectBtn, disconnectBtn, shareCard } = await import("../dist/renderer/renderer/dom.js");

function resetSession() {
  session.pc = null;
  session.ws = null;
  session.captureStream = null;
  session.dataChannel = null;
  session.hostStatsTimer = null;
  session.currentSessionId = null;
  session.currentConfig = null;
  session.currentGameId = null;
  session.activeSaveSyncContext = null;
  session.isStreaming = false;
  session.gamepadWarnedOnce = false;
  session.wsReconnectTimer = null;
  session.pendingTeardown = null;
  session.libraryEntries = [];
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  shareCard.hidden = true;
}

beforeEach(() => {
  resetSession();
});

afterEach(() => {
  cancelDeferredTeardown();
  if (session.hostStatsTimer) clearInterval(session.hostStatsTimer);
  if (session.wsReconnectTimer) clearTimeout(session.wsReconnectTimer);
  resetSession();
});

test("showPlayerLink builds play URL and reveals share card", () => {
  showPlayerLink(
    { apiBaseUrl: "https://platform.example.com/" },
    "player-token-42",
  );
  const input = document.getElementById("player-link");
  assert.equal(input.value, "https://platform.example.com/play/player-token-42");
  assert.equal(document.getElementById("share-card").hidden, false);
});

test("createSession posts host config and returns session ids", async () => {
  let capturedUrl = "";
  let capturedBody = null;
  globalThis.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      async json() {
        return { id: "sess-99", playerToken: "ptok-99", gameId: "g1" };
      },
    };
  };

  const result = await createSession(
    { ...defaultHostConfig, appName: "My Game" },
    "g1",
  );

  assert.match(capturedUrl, /\/api\/sessions$/);
  assert.equal(capturedBody.hostToken, defaultHostConfig.hostToken);
  assert.equal(capturedBody.requestedGameId, "g1");
  assert.deepEqual(result, { sessionId: "sess-99", playerToken: "ptok-99", gameId: "g1" });
});

test("createSession throws on API error", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    async json() {
      return { error: "invalid token" };
    },
  });

  await assert.rejects(
    () => createSession(defaultHostConfig, null),
    /invalid token/,
  );
});

test("fetchSessionContext returns server fields", async () => {
  globalThis.fetch = async (url) => {
    assert.match(url, /\/api\/sessions\/sess-42\?hostToken=/);
    return {
      ok: true,
      async json() {
        return { gameId: "g5", claimedByPlayerId: "p1", isTest: true };
      },
    };
  };

  const ctx = await fetchSessionContext(defaultHostConfig, "sess-42");
  assert.deepEqual(ctx, { gameId: "g5", claimedByPlayerId: "p1", isTest: true });
});

test("fetchSessionContext returns null on HTTP error", async () => {
  globalThis.fetch = async () => ({ ok: false });
  const ctx = await fetchSessionContext(defaultHostConfig, "sess-x");
  assert.equal(ctx, null);
});

test("sendControlReject sends reject message when WS is open", () => {
  const sent = [];
  session.ws = {
    readyState: 1,
    send: (msg) => sent.push(msg),
  };

  sendControlReject("host_busy");

  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0]), {
    type: "control",
    action: "reject",
    reason: "host_busy",
  });
});

test("onPlayerJoined rejects duplicate peer when already streaming", async () => {
  session.isStreaming = true;
  const sent = [];
  session.ws = { readyState: 1, send: (msg) => sent.push(msg) };

  await onPlayerJoined(defaultHostConfig);

  assert.equal(session.isStreaming, true);
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(sent[0]).reason, "host_busy");
});

test("teardownPeer clears streaming state and peer connection", () => {
  session.isStreaming = true;
  session.hostStatsTimer = setInterval(() => {}, 10_000);
  let pcClosed = false;
  session.pc = { close: () => { pcClosed = true; } };
  session.dataChannel = { close: () => {} };
  session.captureStream = {
    getTracks: () => [{ stop: () => {} }],
  };
  window.agent.disconnectGamepad = () => {};
  window.agent.clearInputGuard = async () => {};

  teardownPeer({ ...defaultHostConfig, killAppOnDisconnect: false });

  assert.equal(session.isStreaming, false);
  assert.equal(session.pc, null);
  assert.equal(session.dataChannel, null);
  assert.equal(session.captureStream, null);
  assert.equal(session.hostStatsTimer, null);
  assert.ok(pcClosed);
});

test("cancelDeferredTeardown clears pending timer", () => {
  session.pendingTeardown = setTimeout(() => {}, 60_000);
  cancelDeferredTeardown();
  assert.equal(session.pendingTeardown, null);
});

test("teardownDeferred schedules teardown for current session", async () => {
  session.currentSessionId = "sess-defer";
  session.currentConfig = { ...defaultHostConfig };
  window.agent.clearInputBlock = () => {};
  window.agent.setCaptureSource = () => {};
  globalThis.fetch = async () => ({ ok: true });

  teardownDeferred("grace period", 30);
  assert.ok(session.pendingTeardown);

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(session.pendingTeardown, null);
  assert.equal(session.currentSessionId, null);
});

test("teardown delegates to teardownAsync", async () => {
  session.currentSessionId = "sess-end";
  session.currentConfig = { ...defaultHostConfig };
  window.agent.clearInputBlock = () => {};
  window.agent.setCaptureSource = () => {};
  globalThis.fetch = async () => ({ ok: true });

  await teardown("manual stop");

  assert.equal(session.currentSessionId, null);
  assert.equal(session.isStreaming, false);
  assert.equal(shareCard.hidden, true);
  assert.equal(connectBtn.disabled, false);
});

test("teardownAsync ends session on server and resets UI", async () => {
  session.currentSessionId = "sess-async";
  session.currentConfig = { ...defaultHostConfig };
  session.ws = { close: () => {} };
  let endCalled = false;
  window.agent.clearInputBlock = () => {};
  window.agent.setCaptureSource = () => {};
  globalThis.fetch = async (url, opts) => {
    if (url.includes("/end") && opts?.method === "PATCH") {
      endCalled = true;
      const body = JSON.parse(opts.body);
      assert.equal(body.hostToken, defaultHostConfig.hostToken);
    }
    return { ok: true };
  };

  await teardownAsync("async stop");

  assert.ok(endCalled);
  assert.equal(session.ws, null);
  assert.equal(session.currentSessionId, null);
});

test("uploadHostStats posts metrics when peer connection exists", async () => {
  session.currentSessionId = "sess-stats";
  let metricsPosted = false;
  session.pc = {
    async getStats() {
      const m = new Map();
      m.set("out1", {
        type: "outbound-rtp",
        kind: "video",
        bytesSent: 125_000,
        framesPerSecond: 60,
        packetsLost: 1,
        packetsSent: 100,
        framesDropped: 0,
      });
      return m;
    },
  };
  globalThis.fetch = async (url, opts) => {
    if (url.includes("/metrics")) {
      metricsPosted = true;
      const body = JSON.parse(opts.body);
      assert.equal(body.samples[0].role, "host");
      assert.ok(body.samples[0].bitrateKbps > 0);
    }
    return { ok: true };
  };

  await uploadHostStats(defaultHostConfig);
  assert.ok(metricsPosted);
});

test("connect handles createSession failure", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async json() {
      return { error: "server down" };
    },
  });

  await connect(defaultHostConfig, null);

  assert.equal(session.currentSessionId, null);
  assert.equal(connectBtn.disabled, false);
});

test("attachWsHandlers wires reconnect handlers on new WebSocket", () => {
  let onopen = null;
  const mockWs = {
    url: "wss://signal.example/ws?role=host",
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send: () => {},
    close: () => {},
  };
  Object.defineProperty(mockWs, "onopen", {
    get: () => onopen,
    set: (fn) => { onopen = fn; },
    configurable: true,
  });

  attachWsHandlers(mockWs, defaultHostConfig, 1000);
  assert.equal(typeof onopen, "function");

  session.isStreaming = true;
  onopen();
  assert.equal(session.ws, mockWs);
});
