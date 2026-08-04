import { test } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

/** Captured spawn calls and child process mock state. */
let spawnMock = {
  calls: [],
  failNext: false,
  lastChild: null,
};

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        getAppPath: () => "/tmp/test-rtmp-agent",
        getPath: () => "/tmp/test-rtmp-agent",
      },
    };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        if (spawnMock.failNext) throw new Error("spawn failed");
        spawnMock.calls.push(args);
        const child = new EventEmitter();
        child.pid = 4242;
        child.exitCode = null;
        child.kill = () => {
          child.exitCode = 0;
        };
        spawnMock.lastChild = child;
        return child;
      },
    };
  }
  return load.apply(this, arguments);
};

async function importRtmpRelay() {
  const url = new URL("../dist/main/main/rtmp-relay.js", import.meta.url);
  url.searchParams.set("v", `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function resetSpawnMock() {
  spawnMock = { calls: [], failNext: false, lastChild: null };
}

const validCfg = {
  streamPlatform: "twitch",
  streamUrl: "rtmp://live.twitch.tv/app",
  streamKey: "live_abc123",
};

test("non-win32: startRtmpRelay returns Windows-only error", { concurrency: false }, async () => {
  if (process.platform === "win32") return;
  resetSpawnMock();
  const { startRtmpRelay } = await importRtmpRelay();
  const result = startRtmpRelay(validCfg);
  assert.deepEqual(result, { ok: false, error: "RTMP relay only supported on Windows" });
  assert.equal(spawnMock.calls.length, 0);
});

test("rejects missing streamUrl or streamKey", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { startRtmpRelay } = await importRtmpRelay();

  assert.deepEqual(startRtmpRelay({ ...validCfg, streamUrl: "" }), {
    ok: false,
    error: "streamUrl and streamKey required",
  });
  assert.deepEqual(startRtmpRelay({ ...validCfg, streamKey: "  " }), {
    ok: false,
    error: "streamUrl and streamKey required",
  });
  assert.equal(spawnMock.calls.length, 0);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: spawns ffmpeg with desktop gdigrab and flv output URL", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { startRtmpRelay, isRelayRunning, stopRtmpRelay } = await importRtmpRelay();
  const result = startRtmpRelay(validCfg);

  assert.deepEqual(result, { ok: true });
  assert.equal(spawnMock.calls.length, 1);
  const [cmd, args, opts] = spawnMock.calls[0];
  assert.equal(cmd, "ffmpeg");
  assert.equal(args[args.length - 1], "rtmp://live.twitch.tv/app/live_abc123");
  assert.ok(args.includes("desktop"));
  assert.equal(opts?.stdio, "ignore");
  assert.equal(isRelayRunning(), true);

  stopRtmpRelay();
  assert.equal(isRelayRunning(), false);

  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: uses window title for gdigrab and substitutes {stream_key} in URL", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { startRtmpRelay, stopRtmpRelay } = await importRtmpRelay();
  const cfg = {
    streamPlatform: "youtube",
    streamUrl: "rtmp://a.rtmp.youtube.com/live2/{stream_key}/",
    streamKey: "yt-key-99",
  };
  startRtmpRelay(cfg, { windowTitle: "Game:Window=Title" });

  const args = spawnMock.calls[0][1];
  assert.ok(args.includes("title=Game Window Title"));
  assert.equal(args[args.length - 1], "rtmp://a.rtmp.youtube.com/live2/yt-key-99");

  stopRtmpRelay();
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: returns ok when relay already running without second spawn", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { startRtmpRelay, stopRtmpRelay } = await importRtmpRelay();
  assert.deepEqual(startRtmpRelay(validCfg), { ok: true });
  assert.deepEqual(startRtmpRelay(validCfg), { ok: true });
  assert.equal(spawnMock.calls.length, 1);

  stopRtmpRelay();
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("win32: syncRtmpWindowTitle restarts ffmpeg with new capture title", { concurrency: false }, async () => {
  const origPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  resetSpawnMock();

  const { startRtmpRelay, syncRtmpWindowTitle, stopRtmpRelay } = await importRtmpRelay();
  startRtmpRelay(validCfg, { windowTitle: "Old Title" });
  assert.equal(spawnMock.calls.length, 1);

  syncRtmpWindowTitle("New Game");
  assert.equal(spawnMock.calls.length, 2);
  assert.ok(spawnMock.calls[1][1].includes("title=New Game"));

  stopRtmpRelay();
  Object.defineProperty(process, "platform", { value: origPlatform });
});

test("fetchStreamRelayConfig returns null on HTTP error or incomplete payload", async () => {
  const { fetchStreamRelayConfig } = await importRtmpRelay();

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await fetchStreamRelayConfig("tok", "https://api.example.com"), null);

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ streamUrl: "", streamKey: "k" }),
  });
  assert.equal(await fetchStreamRelayConfig("tok", "https://api.example.com/"), null);

  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  assert.equal(await fetchStreamRelayConfig("tok", "https://api.example.com"), null);

  globalThis.fetch = origFetch;
});

test("fetchStreamRelayConfig returns relay config on success", async () => {
  const { fetchStreamRelayConfig } = await importRtmpRelay();
  const origFetch = globalThis.fetch;
  let capturedUrl;
  let capturedHeaders;

  globalThis.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedHeaders = opts?.headers;
    return {
      ok: true,
      json: async () => ({
        streamPlatform: "twitch",
        streamUrl: "rtmp://live.twitch.tv/app",
        streamKey: "secret-key",
      }),
    };
  };

  const cfg = await fetchStreamRelayConfig("host-tok", "https://api.example.com/");
  assert.deepEqual(cfg, {
    streamPlatform: "twitch",
    streamUrl: "rtmp://live.twitch.tv/app",
    streamKey: "secret-key",
  });
  assert.equal(capturedUrl, "https://api.example.com/api/hosts/me/stream-relay");
  assert.equal(capturedHeaders["x-host-token"], "host-tok");

  globalThis.fetch = origFetch;
});
