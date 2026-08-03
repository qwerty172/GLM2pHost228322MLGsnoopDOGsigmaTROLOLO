import { test } from "node:test";
import assert from "node:assert/strict";
import { installRendererEnv, RENDERER_DIST } from "./helpers/renderer-env.mjs";

installRendererEnv();

const { escHtml } = await import(new URL("utils.js", RENDERER_DIST).href);

test("escHtml escapes HTML special characters", () => {
  assert.equal(escHtml("a&b<c>\"d"), "a&amp;b&lt;c&gt;&quot;d");
  assert.equal(escHtml("plain"), "plain");
});
