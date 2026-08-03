import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { exeBasename } = await import(new URL("capture.js", RENDERER_DIST).href);

test("exeBasename strips path and .exe extension", () => {
  assert.equal(exeBasename("C:\\Steam\\game.exe"), "game");
  assert.equal(exeBasename("/opt/game.EXE"), "game");
  assert.equal(exeBasename(undefined), undefined);
});
