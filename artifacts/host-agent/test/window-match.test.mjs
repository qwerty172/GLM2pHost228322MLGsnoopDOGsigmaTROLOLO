import { test } from "node:test";
import assert from "node:assert/strict";

const {
  exeBasename,
  hostFromBoundUrl,
  findBrowserCaptureSource,
  findNativeCaptureSource,
  findCaptureSourceByTitle,
  browserWindowStillOpen,
  looksLikeBrowserWindow,
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
