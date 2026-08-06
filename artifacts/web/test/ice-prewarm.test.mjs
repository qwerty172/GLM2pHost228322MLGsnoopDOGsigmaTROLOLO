import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

const apiIceServers = [{ urls: "stun:custom.example:3478" }];
const fallbackIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const createdPcs = [];

class MockRTCPeerConnection {
  constructor(opts) {
    this.iceServers = opts?.iceServers;
    this.closed = false;
    createdPcs.push(this);
  }
  createDataChannel() {
    return {};
  }
  async createOffer() {
    return { type: "offer", sdp: "v=0" };
  }
  async setLocalDescription() {}
  close() {
    this.closed = true;
  }
}

globalThis.RTCPeerConnection = MockRTCPeerConnection;

const { prewarmIce, takePrewarmedIceServers, takePrewarmedConnection, discardPrewarm } = await import(
  "../src/lib/ice-prewarm.ts"
);

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(body),
  };
}

function mockIceConfigFetch(handler) {
  mock.method(globalThis, "fetch", async (url) => {
    const path = String(url);
    if (path.includes("/api/public/ice-config")) {
      return handler();
    }
    throw new Error(`unexpected fetch: ${path}`);
  });
}

afterEach(() => {
  for (const hostId of ["host-1", "host-2", "host-3"]) {
    discardPrewarm(hostId);
  }
  createdPcs.length = 0;
  mock.restoreAll();
  globalThis.RTCPeerConnection = MockRTCPeerConnection;
});

test("prewarmIce no-ops for empty hostId", async () => {
  let fetchCalls = 0;
  mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    return jsonResponse({ iceServers: apiIceServers });
  });

  await prewarmIce("");

  assert.equal(fetchCalls, 0);
  assert.equal(createdPcs.length, 0);
});

test("prewarmIce fetches ICE config and caches a peer connection", async () => {
  mockIceConfigFetch(() => jsonResponse({ iceServers: apiIceServers }));

  await prewarmIce("host-1");

  assert.equal(createdPcs.length, 1);
  assert.deepEqual(createdPcs[0].iceServers, apiIceServers);

  const taken = takePrewarmedIceServers("host-1");
  assert.ok(taken);
  assert.deepEqual(taken, apiIceServers);
  assert.equal(createdPcs[0].closed, true);
  assert.equal(takePrewarmedIceServers("host-1"), null);
});

test("prewarmIce skips duplicate hostId while cached", async () => {
  let fetchCalls = 0;
  mockIceConfigFetch(() => {
    fetchCalls += 1;
    return jsonResponse({ iceServers: apiIceServers });
  });

  await prewarmIce("host-1");
  await prewarmIce("host-1");

  assert.equal(fetchCalls, 1);
  assert.equal(createdPcs.length, 1);
});

test("prewarmIce falls back to Google STUN when API fails", async () => {
  mockIceConfigFetch(() => jsonResponse({ error: "offline" }, 503));

  await prewarmIce("host-2");

  assert.equal(createdPcs.length, 1);
  assert.deepEqual(createdPcs[0].iceServers, fallbackIceServers);

  const taken = takePrewarmedIceServers("host-2");
  assert.deepEqual(taken, fallbackIceServers);
  assert.equal(createdPcs[0].closed, true);
});

test("prewarmIce falls back when API returns empty iceServers", async () => {
  mockIceConfigFetch(() => jsonResponse({ iceServers: [] }));

  await prewarmIce("host-2");
  assert.deepEqual(createdPcs[0].iceServers, fallbackIceServers);
});

test("discardPrewarm closes and removes cached connection", async () => {
  mockIceConfigFetch(() => jsonResponse({ iceServers: apiIceServers }));

  await prewarmIce("host-3");
  const pc = createdPcs[0];

  discardPrewarm("host-3");

  assert.equal(pc.closed, true);
  assert.equal(takePrewarmedIceServers("host-3"), null);
});

test("takePrewarmedIceServers evicts expired cache entries", async () => {
  mockIceConfigFetch(() => jsonResponse({ iceServers: apiIceServers }));

  const realNow = Date.now;
  let now = 1_000_000;
  mock.method(Date, "now", () => now);

  try {
    await prewarmIce("host-1");
    now += 121_000;

    assert.equal(takePrewarmedIceServers("host-1"), null);
    assert.equal(createdPcs[0].closed, true);
  } finally {
    Date.now = realNow;
  }
});

test("takePrewarmedConnection compat wrapper returns iceServers only", async () => {
  mockIceConfigFetch(() => jsonResponse({ iceServers: apiIceServers }));

  await prewarmIce("host-1");

  const taken = takePrewarmedConnection("host-1");
  assert.ok(taken);
  assert.deepEqual(taken.iceServers, apiIceServers);
  assert.equal("pc" in taken, false);
});
