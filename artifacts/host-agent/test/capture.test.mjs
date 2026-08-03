import "../test/setup-renderer-dom.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { exeBasename } = await import("../dist/renderer/renderer/capture.js");

test("exeBasename extracts name without extension", () => {
  assert.equal(exeBasename("C:\\Games\\MyGame.exe"), "mygame");
  assert.equal(exeBasename("/usr/games/foo.EXE"), "foo");
});

test("exeBasename handles empty and null paths", () => {
  assert.equal(exeBasename(""), "");
  assert.equal(exeBasename(null), undefined);
  assert.equal(exeBasename(undefined), undefined);
});
