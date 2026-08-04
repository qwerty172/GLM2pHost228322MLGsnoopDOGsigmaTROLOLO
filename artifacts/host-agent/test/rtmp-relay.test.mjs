import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Captured spawn calls for assertions. */
let spawnMock = {
  calls: [],
  failNext: false,
  lastChild: null,
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
        child.pid = 6060;
        child.exitCode = null;
        child.kill = (signal) => {
          child.exitCode = 0;
          child.emit("exit", 0);
        };
        spawnMock.lastChild = child;
        return child;
      },
    };
  }
  return load.apply(this, arguments);
};

const {
  startRtmpRelay,
  stopRtmpRelay,
  isRelayRunning,
  syncRtmpWindowTitle,
  fetchStreamRelayConfig,
} = await import("../dist/main/main/rtmp-relay.js");

function resetSpawnMock() {
  spawnMock = { calls: [], failNext: false, lastChild: null };
}

const baseCfg = {
  streamPlatform: "twitch",
  streamUrl: "rtmp://live.twitch.tv/app/",
  streamKey: "secret-key",
};

beforeEach(() => {
  resetSpawnMock();
  stopRtmpRelay();
});

test("non-win32: startRtmpRelay returns Windows-only error", { concurrency: false }, () => {
  if (process.platform === "win32") return;
  const result = startRtmpRelay(baseCfg);
  assert.deepEqual(result, { ok: false, error: "RTMP relay only supported on Windows" });
});

test("win32: rejects missing streamUrl or streamKey", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  assert.deepEqual(startRtmpRelay({ ...baseCfg, streamUrl: "" }), {
    ok: false,
    error: "streamUrl and streamKey required",
  });
  assert.deepEqual(startRtmpRelay({ ...baseCfg, streamKey: "" }), {
    ok: false,
    error: "streamUrl and streamKey required",
  });
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: spawns ffmpeg with desktop gdigrab and appended stream key", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  const result = startRtmpRelay(baseCfg);

  assert.deepEqual(result, { ok: true });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "ffmpeg");
  assert.equal(args[args.length - 1], "rtmp://live.twitch.tv/app/secret-key");
  assert.equal(args[args.indexOf("-i") + 1], "desktop");
  assert.equal(opts.stdio, "ignore");
  assert.equal(opts.windowsHide, true);
  assert.equal(isRelayRunning(), true);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: replaces {stream_key} placeholder in streamUrl", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  startRtmpRelay({
    streamPlatform: "custom",
    streamUrl: "rtmp://ingest.example/live/{stream_key}",
    streamKey: "my-key",
  });

  const args = spawnMock.calls[0][1];
  assert.equal(args[args.length - 1], "rtmp://ingest.example/live/my-key");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: window title sanitizes gdigrab special chars", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  startRtmpRelay(baseCfg, { windowTitle: "Game=Title:foo,bar" });

  const args = spawnMock.calls[0][1];
  assert.equal(args[args.indexOf("-i") + 1], "title=Game Title foo bar");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: second start while running returns ok without extra spawn", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  assert.deepEqual(startRtmpRelay(baseCfg), { ok: true });
  assert.deepEqual(startRtmpRelay(baseCfg), { ok: true });
  assert.equal(spawnMock.calls.length, 1);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: stopRtmpRelay clears running state", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  startRtmpRelay(baseCfg);
  assert.equal(isRelayRunning(), true);
  stopRtmpRelay();
  assert.equal(isRelayRunning(), false);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: spawn failure returns error string", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  spawnMock.failNext = true;

  const result = startRtmpRelay(baseCfg);

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /spawn failed/);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: syncRtmpWindowTitle restarts ffmpeg with new capture title", { concurrency: false }, () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });

  startRtmpRelay(baseCfg);
  spawnMock.calls.length = 0;

  syncRtmpWindowTitle("New Window");

  assert.equal(spawnMock.calls.length, 1);
  const args = spawnMock.calls[0][1];
  assert.equal(args[args.indexOf("-i") + 1], "title=New Window");

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("fetchStreamRelayConfig returns config on success", async () => {
  const cfg = {
    streamPlatform: "youtube",
    streamUrl: "rtmp://a.rtmp.youtube.com/live2/",
    streamKey: "yt-key",
  };
  const restore = mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.example.com/api/hosts/me/stream-relay");
    assert.equal(init.headers["x-host-token"], "host-tok");
    return { ok: true, json: async () => cfg };
  });
  try {
    assert.deepEqual(await fetchStreamRelayConfig("host-tok", "https://api.example.com/"), cfg);
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null on HTTP error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({ ok: false, status: 403 }));
  try {
    assert.equal(await fetchStreamRelayConfig("t", "https://api.example.com"), null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null when url or key missing", async () => {
  const restore = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ streamPlatform: "twitch", streamUrl: "", streamKey: "k" }),
  }));
  try {
    assert.equal(await fetchStreamRelayConfig("t", "https://api.example.com"), null);
  } finally {
    restore.mock.restore();
  }
});

test("fetchStreamRelayConfig returns null on network error", async () => {
  const restore = mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  try {
    assert.equal(await fetchStreamRelayConfig("t", "https://api.example.com"), null);
  } finally {
    restore.mock.restore();
  }
});
