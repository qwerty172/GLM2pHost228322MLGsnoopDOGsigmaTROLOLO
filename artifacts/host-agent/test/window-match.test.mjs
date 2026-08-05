import { test } from "node:test";
import assert from "node:assert/strict";

const {
  exeBasename,
  hostFromBoundUrl,
  findBrowserCaptureSource,
  findNativeCaptureSource,
  findCaptureSourceByTitle,
  findCaptureSourceByHwnds,
  parseHwndFromSourceId,
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

test("findCaptureSourceByTitle matches exact and case-insensitive titles", () => {
  assert.equal(findCaptureSourceByTitle(sources, "Discord")?.id, "window:3");
  assert.equal(
    findCaptureSourceByTitle(sources, "shellshock.io - microsoft edge")?.id,
    "window:2",
  );
});

test("browserWindowStillOpen uses hostname heuristics before capture lock", () => {
  assert.equal(browserWindowStillOpen(sources, "shellshock.io"), true);
  assert.equal(browserWindowStillOpen([{ id: "window:9", name: "Notepad" }], "game.io"), false);
});

test("browserWindowStillOpen does not treat unrelated Chrome as alive after capture lock", () => {
  const onlyChrome = [
    { id: "window:1", name: "New Tab - Google Chrome" },
    { id: "window:2", name: "Notepad" },
  ];
  assert.equal(
    browserWindowStillOpen(onlyChrome, "shellshock.io", {
      captureTitle: "shellshock.io - Microsoft Edge",
    }),
    false,
  );
  assert.equal(
    browserWindowStillOpen(onlyChrome, "shellshock.io"),
    false,
  );
});

test("browserWindowStillOpen tracks locked HWND after capture", () => {
  const sourcesWithHwnd = [
    { id: "window:100:0", name: "New Tab - Google Chrome" },
    { id: "window:200:0", name: "shellshock.io - Microsoft Edge" },
  ];
  assert.equal(
    browserWindowStillOpen(sourcesWithHwnd, "shellshock.io", { captureHwnd: 200 }),
    true,
  );
  assert.equal(
    browserWindowStillOpen(
      [{ id: "window:100:0", name: "New Tab - Google Chrome" }],
      "shellshock.io",
      { captureHwnd: 200 },
    ),
    false,
  );
});

test("browserWindowStillOpen matches locked capture title case-insensitively", () => {
  const wins = [{ id: "window:1", name: "Game Tab - Google Chrome" }];
  assert.equal(
    browserWindowStillOpen(wins, "", { captureTitle: "game tab - google chrome" }),
    true,
  );
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

test("parseHwndFromSourceId extracts HWND from Electron window id", () => {
  assert.equal(parseHwndFromSourceId("window:12345:0"), 12345);
  assert.equal(parseHwndFromSourceId("screen:0:0"), null);
  assert.equal(parseHwndFromSourceId("window:bad:0"), null);
});

test("findCaptureSourceByHwnds prefers first HWND in priority list", () => {
  const hwndSources = [
    { id: "screen:0:0", name: "Entire screen" },
    { id: "window:100:0", name: "Launcher" },
    { id: "window:200:0", name: "RogueFable3" },
    { id: "window:300:0", name: "Discord" },
  ];
  const picked = findCaptureSourceByHwnds(hwndSources, [200, 100]);
  assert.equal(picked?.id, "window:200:0");
  assert.equal(findCaptureSourceByHwnds(hwndSources, []), undefined);
});
