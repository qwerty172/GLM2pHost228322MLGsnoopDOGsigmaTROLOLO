import { test } from "node:test";
import assert from "node:assert/strict";

const { isBrowserExeName } = await import("../dist/main/main/browser-exe-names.js");

test("isBrowserExeName recognizes common browser executables", () => {
  assert.equal(isBrowserExeName("chrome.exe"), true);
  assert.equal(isBrowserExeName("MSedge.EXE"), true);
  assert.equal(isBrowserExeName("firefox.exe"), true);
});

test("isBrowserExeName rejects non-browser executables", () => {
  assert.equal(isBrowserExeName("notepad.exe"), false);
  assert.equal(isBrowserExeName("steam.exe"), false);
  assert.equal(isBrowserExeName(""), false);
});
