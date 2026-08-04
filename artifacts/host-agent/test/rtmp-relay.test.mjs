import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Captured spawn calls for assertions. */
const spawnMock = {
  calls: [],
  failNext: false,
  children: [],
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getAppPath: () => "/tmp/test-rtmp-relay-agent" } };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        if (spawnMock.failNext) throw new Error("spawn failed");
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = 6060 + spawnMock.children.length;
        child.exitCode = null;
        child.kill = () => {
          child.exitCode = 0;
        };
        spawnMock.children.push(child);
        return child;
      },
    };
  }
  return load.apply(this, arguments);
};

const {
  isRelayRunning,
  stopRtmpRelay,
  startRtmpRelay,
  syncRtmpWindowTitle,
  fetchStreamRelayConfig,
} = await import("../dist/main/main/rtmp-relay.js");

const baseCfg = {
  streamPlatform: "twitch",
  streamUrl: "rtmp://live.twitch.tv/app",
  streamKey: "live_abc123",
};

beforeEach(() => {
  stopRtmpRelay();
  spawnMock.calls = [];
  spawnMock.failNext = false;
  spawnMock.children = [];
});

test("non-win32: startRtmpRelay returns Windows-only error", { concurrency: false }, () => {
  if (process.platform === "win32") return;
  const result = startRtmpRelay(baseCfg);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /Windows/i);
  assert.equal(isRelayRunning(), false);
});

test("win32 mocked: rejects missing streamUrl or streamKey", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    assert.deepEqual(startRtmpRelay({ ...baseCfg, streamUrl: "" }), {
      ok: false,
      error: "streamUrl and streamKey required",
    });
    assert.deepEqual(startRtmpRelay({ ...baseCfg, streamKey: "  " }), {
      ok: false,
      error: "streamUrl and streamKey required",
    });
    assert.equal(spawnMock.calls.length, 0);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: spawns ffmpeg with desktop grab by default", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    const result = startRtmpRelay(baseCfg);
    assert.equal(result.ok, true);
    assert.equal(isRelayRunning(), true);
    assert.equal(spawnMock.calls.length, 1);
    const [cmd, args, opts] = spawnMock.calls[0];
    assert.equal(cmd, "ffmpeg");
    assert.equal(args[args.indexOf("-i") + 1], "desktop");
    assert.equal(args.at(-1), "rtmp://live.twitch.tv/app/live_abc123");
    assert.deepEqual(opts, { stdio: "ignore", windowsHide: true });
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: uses window title grab and sanitizes special chars", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    startRtmpRelay(baseCfg, { windowTitle: "Game: v1, beta" });
    const args = spawnMock.calls[0][1];
    assert.equal(args[args.indexOf("-i") + 1], "title=Game  v1  beta");
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: buildRtmpUrl replaces {stream_key} placeholder", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    startRtmpRelay({
      ...baseCfg,
      streamUrl: "rtmp://ingest.example/{stream_key}/",
      streamKey: "secret-key",
    });
    const args = spawnMock.calls[0][1];
    assert.equal(args.at(-1), "rtmp://ingest.example/secret-key");
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: start when already running is idempotent", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    assert.equal(startRtmpRelay(baseCfg).ok, true);
    assert.equal(startRtmpRelay(baseCfg).ok, true);
    assert.equal(spawnMock.calls.length, 1);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: stopRtmpRelay kills ffmpeg and clears running state", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    startRtmpRelay(baseCfg);
    const child = spawnMock.children[0];
    let killed = false;
    child.kill = () => {
      killed = true;
      child.exitCode = 0;
    };
    stopRtmpRelay();
    assert.equal(killed, true);
    assert.equal(isRelayRunning(), false);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: spawn failure returns error string", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    spawnMock.failNext = true;
    const result = startRtmpRelay(baseCfg);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /spawn failed/);
    assert.equal(isRelayRunning(), false);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: syncRtmpWindowTitle restarts relay with new title", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    startRtmpRelay(baseCfg);
    syncRtmpWindowTitle("New Game Window");
    assert.equal(spawnMock.calls.length, 2);
    const restartArgs = spawnMock.calls[1][1];
    assert.equal(restartArgs[restartArgs.indexOf("-i") + 1], "title=New Game Window");
    assert.equal(isRelayRunning(), true);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("win32 mocked: syncRtmpWindowTitle noop when relay not running", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    syncRtmpWindowTitle("Ignored");
    assert.equal(spawnMock.calls.length, 0);
  } finally {
    Object.defineProperty(process, "platform", { value: origPlatform });
  }
});

test("fetchStreamRelayConfig returns parsed config on success", async () => {
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.com/api/hosts/me/stream-relay");
    assert.equal(init.headers["x-host-token"], "host-tok");
    return {
      ok: true,
      json: async () => ({
        streamPlatform: "youtube",
        streamUrl: "rtmp://a.rtmp.youtube.com/live2",
        streamKey: "yt-key",
      }),
    };
  });
  try {
    const cfg = await fetchStreamRelayConfig("host-tok", "https://api.example.com/");
    assert.deepEqual(cfg, {
      streamPlatform: "youtube",
      streamUrl: "rtmp://a.rtmp.youtube.com/live2",
      streamKey: "yt-key",
    });
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null on HTTP error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false }));
  try {
    const cfg = await fetchStreamRelayConfig("bad", "https://api.example.com");
    assert.equal(cfg, null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null when stream fields missing", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ streamPlatform: "twitch", streamUrl: "", streamKey: "k" }),
  }));
  try {
    const cfg = await fetchStreamRelayConfig("tok", "https://api.example.com");
    assert.equal(cfg, null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null on network failure", async () => {
  const restore = mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  try {
    const cfg = await fetchStreamRelayConfig("tok", "https://api.example.com");
    assert.equal(cfg, null);
  } finally {
    restore.mock.restore();
  }
});
