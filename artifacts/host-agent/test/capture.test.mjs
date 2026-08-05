import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv, defaultHostConfig } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { captureScreen } = await import("../dist/renderer/renderer/capture.js");
const { session } = await import("../dist/renderer/renderer/state.js");

beforeEach(() => {
  session.currentGameId = null;
  session.currentCaptureSourceName = "";
  session.libraryEntries = [];
  Object.assign(defaultHostConfig, {
    appPath: "C:\\Games\\Test\\game.exe",
    boundUrl: "",
    captureSourceName: "",
  });
});

test("captureScreen picks native game window by exe basename in title", async () => {
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:1", name: "RogueFable3" },
    { id: "window:2", name: "Discord" },
  ];
  await captureScreen({
    ...defaultHostConfig,
    appPath: "C:\\Games\\rf3\\RogueFable3.exe",
  });
  assert.equal(session.currentCaptureSourceName, "RogueFable3");
});

test("captureScreen prefers library entry appPath for currentGameId", async () => {
  session.currentGameId = "game-1";
  session.libraryEntries = [
    { gameId: "game-1", appPath: "D:\\Steam\\shellshock\\ShellShock.exe", enabled: true },
  ];
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:1", name: "shellshock - fullscreen" },
  ];
  await captureScreen(defaultHostConfig);
  assert.equal(session.currentCaptureSourceName, "shellshock - fullscreen");
});

test("captureScreen picks browser window by boundUrl hostname", async () => {
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:1", name: "shellshock.io - Microsoft Edge" },
  ];
  await captureScreen({
    ...defaultHostConfig,
    boundUrl: "https://shellshock.io/play",
    appPath: "",
  });
  assert.equal(session.currentCaptureSourceName, "shellshock.io - Microsoft Edge");
});

test("captureScreen uses configured captureSourceName when set", async () => {
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:1", name: "My Custom Window" },
    { id: "window:2", name: "game" },
  ];
  await captureScreen({
    ...defaultHostConfig,
    captureSourceName: "My Custom Window",
  });
  assert.equal(session.currentCaptureSourceName, "My Custom Window");
});

test("captureScreen prefers HWND match from spawned PID over title heuristics", async () => {
  window.agent.getSpawnHwnds = async () => ({ pid: 4242, hwnds: [98765] });
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:98765:0", name: "Unrelated Title" },
    { id: "window:11111:0", name: "RogueFable3" },
  ];
  await captureScreen({
    ...defaultHostConfig,
    appPath: "C:\\Games\\rf3\\RogueFable3.exe",
  });
  assert.equal(session.currentCaptureSourceName, "Unrelated Title");
});

test("captureScreen with allowScreenFallback:false rejects screen fallback for single-game library", async () => {
  session.libraryEntries = [
    { gameId: "game-1", appPath: "C:\\Games\\rf3\\RogueFable3.exe", enabled: true, localAvailable: true },
  ];
  window.agent.getCaptureSources = async () => [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:2", name: "Discord" },
  ];
  await assert.rejects(
    () =>
      captureScreen(
        {
          ...defaultHostConfig,
          appPath: "C:\\Games\\rf3\\RogueFable3.exe",
        },
        { allowScreenFallback: false },
      ),
    /Окно «roguefable3» не найдено/i,
  );
});
