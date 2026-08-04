import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();

const { captureScreen } = await import("../dist/renderer/renderer/capture.js");
const { session } = await import("../dist/renderer/renderer/state.js");

const sources = [
  { id: "screen:0:0", name: "Primary Screen" },
  { id: "window:1", name: "shellshock.io - Google Chrome" },
  { id: "window:2", name: "RogueFable3" },
  { id: "window:3", name: "Discord" },
];

beforeEach(() => {
  session.currentGameId = "";
  session.libraryEntries = [];
  session.currentCaptureSourceName = "";
  session.captureWidth = 1920;
  session.captureHeight = 1080;
  globalThis.window.agent.getCaptureSources = async () => [...sources];
});

test("captureScreen uses explicit captureSourceName", async () => {
  let setTitle = "";
  globalThis.window.agent.setCaptureSource = (title) => {
    setTitle = title;
  };

  const cfg = { ...defaultHostConfig, captureSourceName: "Discord" };
  const stream = await captureScreen(cfg);

  assert.ok(stream);
  assert.equal(setTitle, "Discord");
  assert.equal(session.currentCaptureSourceName, "Discord");
});

test("captureScreen auto-picks browser window for boundUrl session", async () => {
  let setTitle = "";
  globalThis.window.agent.setCaptureSource = (title) => {
    setTitle = title;
  };

  const cfg = {
    ...defaultHostConfig,
    boundUrl: "https://shellshock.io/play",
    captureSourceName: "",
  };
  await captureScreen(cfg);

  assert.equal(setTitle, "shellshock.io - Google Chrome");
});

test("captureScreen auto-picks native window by exe basename", async () => {
  let setTitle = "";
  globalThis.window.agent.setCaptureSource = (title) => {
    setTitle = title;
  };

  const cfg = {
    ...defaultHostConfig,
    appPath: "C:\\Games\\RogueFable3.exe",
    boundUrl: "",
    captureSourceName: "",
  };
  await captureScreen(cfg);

  assert.equal(setTitle, "RogueFable3");
});

test("captureScreen prefers library entry exe over cfg.appPath", async () => {
  let setTitle = "";
  globalThis.window.agent.setCaptureSource = (title) => {
    setTitle = title;
  };

  session.currentGameId = "game-1";
  session.libraryEntries = [
    {
      gameId: "game-1",
      appPath: "D:\\Steam\\RogueFable3.exe",
      boundUrl: "",
      enabled: true,
      localAvailable: true,
    },
  ];

  const cfg = {
    ...defaultHostConfig,
    appPath: "C:\\Other\\wrong.exe",
    captureSourceName: "",
  };
  await captureScreen(cfg);

  assert.equal(setTitle, "RogueFable3");
});

test("captureScreen uses library boundUrl for browser game", async () => {
  let setTitle = "";
  globalThis.window.agent.setCaptureSource = (title) => {
    setTitle = title;
  };

  session.currentGameId = "browser-1";
  session.libraryEntries = [
    {
      gameId: "browser-1",
      boundUrl: "https://shellshock.io/play",
      enabled: true,
    },
  ];

  const cfg = {
    ...defaultHostConfig,
    boundUrl: "",
    captureSourceName: "",
  };
  await captureScreen(cfg);

  assert.equal(setTitle, "shellshock.io - Google Chrome");
});

test("captureScreen throws when no sources available", async () => {
  globalThis.window.agent.getCaptureSources = async () => [];

  await assert.rejects(
    () => captureScreen({ ...defaultHostConfig }),
    /Нет доступных источников/,
  );
});
