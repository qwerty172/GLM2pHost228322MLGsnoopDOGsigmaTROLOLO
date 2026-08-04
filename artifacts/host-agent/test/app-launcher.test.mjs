import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { EventEmitter } from "node:events";

const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      shell: { openExternal: () => Promise.resolve() },
      desktopCapturer: {
        getSources: async () => [{ id: "window:123:0", name: "Chrome - example.com" }],
      },
    };
  }
  if (request === "node:child_process") {
    return {
      spawn: (...args) => {
        const child = new EventEmitter();
        child.pid = 4242;
        child.exitCode = null;
        child.kill = () => {
          child.exitCode = 0;
        };
        return child;
      },
    };
  }
  return load.apply(this, arguments);
};

const {
  parseArgs,
  getLastSpawnedPid,
  setExitCallback,
  clearExitCallback,
  isRunning,
  killApp,
  launchEntry,
  launchApp,
} = await import("../dist/main/main/app-launcher.js");

beforeEach(() => {
  clearExitCallback();
  killApp();
});

test("parseArgs splits on whitespace outside quotes", () => {
  assert.deepEqual(parseArgs("-map test -log"), ["-map", "test", "-log"]);
});

test("parseArgs preserves quoted spans", () => {
  assert.deepEqual(parseArgs('-map "Custom Map.umap" -log'), ["-map", "Custom Map.umap", "-log"]);
});

test("parseArgs handles escaped quotes inside quotes", () => {
  assert.deepEqual(parseArgs('"say \\"hi\\"" rest'), ["say \"hi\"", "rest"]);
});

test("parseArgs returns empty array for empty input", () => {
  assert.deepEqual(parseArgs(""), []);
  assert.deepEqual(parseArgs("   \t  "), []);
});

test("getLastSpawnedPid is null before launch", () => {
  assert.equal(getLastSpawnedPid(), null);
});

test("isRunning is false before launch", () => {
  assert.equal(isRunning(), false);
});

test("setExitCallback and clearExitCallback", () => {
  let called = false;
  setExitCallback(() => {
    called = true;
  });
  clearExitCallback();
  killApp();
  assert.equal(called, false);
});

test("launchEntry rejects non-http boundUrl", async () => {
  const result = await launchEntry({
    appPath: "",
    boundUrl: "file:///etc/passwd",
    launchArgs: "",
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /http/i);
});

test("launchEntry rejects entry without appPath or boundUrl", async () => {
  const result = await launchEntry({ appPath: "", boundUrl: "", launchArgs: "" });
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /no appPath/i);
});

test("launchEntry opens browser URL and disables focus guard", async () => {
  const result = await launchEntry({
    appPath: "",
    boundUrl: "https://game.example/play",
    launchArgs: "",
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(isRunning(), false);
});

test("launchApp rejects invalid boundUrl protocol", async () => {
  const result = await launchApp({
    hostToken: "t",
    apiBaseUrl: "https://api.example.com",
    signalingUrl: "",
    appPath: "",
    appArgs: "",
    appName: "",
    boundUrl: "ftp://files.example",
    captureSourceName: "",
    ratePerMinute: 0,
    commissionSplit: 0.5,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 1000,
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
    allowPreview: true,
    audioMode: "off",
  });
  assert.equal(result.ok, false);
});

test("launchApp spawns native exe and records pid", async () => {
  const result = await launchApp({
    hostToken: "t",
    apiBaseUrl: "https://api.example.com",
    signalingUrl: "",
    appPath: "C:\\Games\\Foo\\game.exe",
    appArgs: "-fullscreen",
    appName: "Foo",
    boundUrl: "",
    captureSourceName: "",
    ratePerMinute: 0,
    commissionSplit: 0.5,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 1000,
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
    allowPreview: true,
    audioMode: "off",
  });
  assert.equal(result.ok, true);
  assert.equal(result.pid, 4242);
  assert.equal(getLastSpawnedPid(), 4242);
  assert.equal(isRunning(), true);
});

test("killApp clears running state", async () => {
  await launchApp({
    hostToken: "t",
    apiBaseUrl: "https://api.example.com",
    signalingUrl: "",
    appPath: "C:\\Games\\Foo\\game.exe",
    appArgs: "",
    appName: "Foo",
    boundUrl: "",
    captureSourceName: "",
    ratePerMinute: 0,
    commissionSplit: 0.5,
    resolution: { width: 1920, height: 1080 },
    bitrateKbps: 1000,
    killAppOnDisconnect: false,
    autoLaunchAtStartup: false,
    allowPreview: true,
    audioMode: "off",
  });
  killApp();
  assert.equal(isRunning(), false);
  assert.equal(getLastSpawnedPid(), null);
});
