import { test } from "node:test";
import assert from "node:assert/strict";

const {
  exeBasename,
  hostFromBoundUrl,
  findBrowserCaptureSource,
  findNativeCaptureSource,
  findCaptureSourceByTitle,
  parseHwndFromSourceId,
  findCaptureSourceByHwnd,
  findCaptureSourceByHwnds,
  browserWindowStillOpen,
  looksLikeBrowserWindow,
  resolveTargetExeName,
} = await import("../dist/main/shared/window-match.js");

const sources = [
  { id: "screen:0:0", name: "Entire screen" },
  { id: "window:1", name: "Rogue Fable III - Google Chrome" },
  { id: "window:2", name: "shellshock.io - Microsoft Edge" },
  { id: "window:3", name: "Discord" },
  { id: "window:4", name: "RogueFable3" },
];

test("exeBasename strips path and .exe extension", () => {
  assert.equal(exeBasename("C:\\Steam\\steamapps\\common\\Game\\Game.EXE"), "game");
  assert.equal(exeBasename("/opt/game/bin/run.exe"), "run");
});

test("exeBasename handles empty input", () => {
  assert.equal(exeBasename(""), "");
  assert.equal(exeBasename(null), undefined);
  assert.equal(exeBasename(undefined), undefined);
});

test("hostFromBoundUrl normalizes hostname", () => {
  assert.equal(hostFromBoundUrl("https://www.shellshock.io/play"), "shellshock.io");
  assert.equal(hostFromBoundUrl("not-a-url"), "");
});

test("findBrowserCaptureSource prefers hostname + browser hint in title", () => {
  const picked = findBrowserCaptureSource(sources, "https://shellshock.io");
  assert.equal(picked?.id, "window:2");
});

test("findBrowserCaptureSource falls back to any browser window", () => {
  const onlyChrome = [
    { id: "window:1", name: "New Tab - Google Chrome" },
    { id: "window:3", name: "Notepad" },
  ];
  const picked = findBrowserCaptureSource(onlyChrome, "https://unknown.example");
  assert.equal(picked?.id, "window:1");
});

test("findNativeCaptureSource matches exe basename in window title", () => {
  const picked = findNativeCaptureSource(sources, "roguefable3");
  assert.equal(picked?.id, "window:4");
});

test("parseHwndFromSourceId reads Electron window id on Windows", () => {
  assert.equal(parseHwndFromSourceId("window:1234:0"), 1234);
  assert.equal(parseHwndFromSourceId("window:99"), 99);
  assert.equal(parseHwndFromSourceId("screen:0"), null);
});

test("findCaptureSourceByHwnds prefers first matching HWND", () => {
  const hwndSources = [
    { id: "screen:0", name: "Primary Screen" },
    { id: "window:9999:0", name: "Wrong Game" },
    { id: "window:4242:0", name: "Spawned Game" },
  ];
  const picked = findCaptureSourceByHwnds(hwndSources, [4242, 9999]);
  assert.equal(picked?.name, "Spawned Game");
  assert.equal(findCaptureSourceByHwnd(hwndSources, 4242)?.id, "window:4242:0");
});

test("findCaptureSourceByTitle matches exact and case-insensitive titles", () => {
  assert.equal(findCaptureSourceByTitle(sources, "Discord")?.id, "window:3");
  assert.equal(
    findCaptureSourceByTitle(sources, "shellshock.io - microsoft edge")?.id,
    "window:2",
  );
});

test("browserWindowStillOpen uses title heuristics, not pid/hwnd", () => {
  assert.equal(browserWindowStillOpen(sources, "shellshock.io"), true);
  assert.equal(browserWindowStillOpen([{ id: "window:9", name: "Notepad" }], "game.io"), false);
});

test("browserWindowStillOpen H-02: any Chrome counts as alive without hostname match", () => {
  const onlyChrome = [
    { id: "window:1", name: "New Tab - Google Chrome" },
    { id: "window:2", name: "Notepad" },
  ];
  assert.equal(browserWindowStillOpen(onlyChrome, "shellshock.io"), true);
  assert.equal(browserWindowStillOpen(onlyChrome, ""), true);
});

test("looksLikeBrowserWindow detects common browsers", () => {
  assert.equal(looksLikeBrowserWindow("Tab - Google Chrome"), true);
  assert.equal(looksLikeBrowserWindow("My App"), false);
});

test("resolveTargetExeName prefers library entry for currentGameId", () => {
  const entries = [
    { gameId: "g1", appPath: "C:\\Games\\rf3\\RogueFable3.exe" },
    { gameId: "g2", appPath: "C:\\Other\\game.exe" },
  ];
  assert.equal(resolveTargetExeName("g1", entries, "C:\\Fallback\\old.exe"), "roguefable3");
});

test("resolveTargetExeName falls back to cfg appPath", () => {
  assert.equal(resolveTargetExeName(null, [], "D:\\Steam\\game\\MyGame.EXE"), "mygame");
  assert.equal(resolveTargetExeName("missing", [], "D:\\Steam\\game\\MyGame.EXE"), "mygame");
});
