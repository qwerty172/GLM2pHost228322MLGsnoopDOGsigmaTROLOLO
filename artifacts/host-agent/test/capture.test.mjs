import { test } from "node:test";
import assert from "node:assert/strict";
import { setupRendererEnv } from "./helpers/renderer-env.mjs";

setupRendererEnv();
const { exeBasename } = await import("../dist/main/shared/window-match.js");

test("exeBasename strips path and .exe extension", () => {
  assert.equal(exeBasename("C:\\Steam\\steamapps\\common\\Game\\Game.EXE"), "game");
  assert.equal(exeBasename("/opt/game/bin/run.exe"), "run");
});

test("exeBasename handles empty input", () => {
  assert.equal(exeBasename(""), "");
  assert.equal(exeBasename(null), undefined);
  assert.equal(exeBasename(undefined), undefined);
});
