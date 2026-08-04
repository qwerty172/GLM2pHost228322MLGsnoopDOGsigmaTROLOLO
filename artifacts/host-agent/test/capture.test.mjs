import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { captureScreen, exeBasename } = await import("../dist/renderer/renderer/capture.js");
const { session } = await import("../dist/renderer/renderer/state.js");

const sources = [
  { id: "screen:0", name: "Primary Screen" },
  { id: "window:1", name: "shellshock.io - Google Chrome" },
  { id: "window:2", name: "roguefable3" },
];

beforeEach(() => {
  session.currentGameId = null;
  session.libraryEntries = [];
  session.currentCaptureSourceName = "";
  session.captureWidth = 1920;
  session.captureHeight = 1080;
  Object.assign(defaultHostConfig, {
    captureSourceName: "",
    appPath: "C:\\Games\\RogueFable3\\roguefable3.exe",
    boundUrl: "",
    audioMode: "off",
    resolution: { width: 1920, height: 1080 },
  });
  window.agent.getCaptureSources = async () => sources;
  window.agent.setCaptureSource = (title) => {
    window.agent._lastCaptureTitle = title;
  };
  window.agent._lastCaptureTitle = "";
});

test("exeBasename strips path and .exe extension", () => {
  assert.equal(exeBasename("C:\\Steam\\steamapps\\common\\Game\\Game.EXE"), "game");
  assert.equal(exeBasename("/opt/game/bin/run.exe"), "run");
});

test("exeBasename handles empty input", () => {
  assert.equal(exeBasename(""), "");
  assert.equal(exeBasename(null), undefined);
  assert.equal(exeBasename(undefined), undefined);
});

test("captureScreen uses explicit captureSourceName", async () => {
  const cfg = { ...defaultHostConfig, captureSourceName: "Primary Screen" };
  const stream = await captureScreen(cfg);
  assert.ok(stream);
  assert.equal(window.agent._lastCaptureTitle, "Primary Screen");
  assert.equal(session.currentCaptureSourceName, "Primary Screen");
});

test("captureScreen auto-matches native game window by exe basename", async () => {
  const stream = await captureScreen({ ...defaultHostConfig });
  assert.ok(stream);
  assert.equal(window.agent._lastCaptureTitle, "roguefable3");
});

test("captureScreen auto-matches browser window for boundUrl", async () => {
  const cfg = {
    ...defaultHostConfig,
    appPath: "",
    boundUrl: "https://shellshock.io/play",
  };
  const stream = await captureScreen(cfg);
  assert.ok(stream);
  assert.equal(window.agent._lastCaptureTitle, "shellshock.io - Google Chrome");
});

test("captureScreen falls back to primary screen when no target configured", async () => {
  const cfg = {
    ...defaultHostConfig,
    appPath: "",
    boundUrl: "",
    captureSourceName: "",
  };
  const stream = await captureScreen(cfg);
  assert.ok(stream);
  assert.equal(window.agent._lastCaptureTitle, "Primary Screen");
});

test("captureScreen throws when no capture sources available", async () => {
  window.agent.getCaptureSources = async () => [];
  await assert.rejects(
    () => captureScreen({ ...defaultHostConfig }),
    /Нет доступных источников/,
  );
});
